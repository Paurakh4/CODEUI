/**
 * Model-agnostic finalizer for follow-up (reprompt) responses.
 *
 * Different LLM providers return very different shapes for the same prompt:
 *   - Gemini non-thinking returns a clean complete HTML document.
 *   - Thinking models (DeepSeek R1, Kimi K2 Thinking, GLM 4.7 thinking, Claude
 *     extended reasoning) prefix output with `<think>...</think>`, scratchpad
 *     reasoning, or rationale paragraphs.
 *   - Some models prefer SEARCH/REPLACE patches even when asked for full HTML.
 *   - Most wrap output in ```html fences or surround it with narration like
 *     "Here is the updated HTML:".
 *
 * This finalizer accepts every shape we have seen and converts it back into a
 * single, complete HTML document. If extraction fails, the caller is expected
 * to keep the previously committed HTML so the user never ends up with a
 * broken page.
 */

import {
  DIVIDER,
  REPLACE_END,
  SEARCH_START,
} from "@/lib/constants"
import { isCompleteHtmlDocument } from "@/lib/ai-update-recovery"
import { StreamParser } from "@/lib/parsers/stream-parser"
import { normalizeHtml } from "@/lib/reprompting/normalize-html"
import { escapeRegExp } from "@/lib/utils/regex-helper"
import { stripThinkingBlocks } from "@/lib/reprompting/thinking-stripper"
import { parseJsonDiff } from "@/lib/reprompting/json-diff-parser"

export type FollowUpFinalizerStrategy =
  | "passthrough"
  | "stripped-thinking"
  | "extracted-from-narration"
  | "fenced-block"
  | "search-replace"
  | "json-diff"

export interface FollowUpFinalizerSuccess {
  ok: true
  html: string
  strategy: FollowUpFinalizerStrategy
  appliedPatchCount?: number
  /**
   * When true, the model complied with the request to return SEARCH/REPLACE
   * patches. When false (and preferPatches was true), the model returned a
   * full HTML document instead — applied as fallback but logged as a warning.
   */
  diffCompliant?: boolean
}

export interface FollowUpFinalizerFailure {
  ok: false
  reason: string
}

export type FollowUpFinalizerResult =
  | FollowUpFinalizerSuccess
  | FollowUpFinalizerFailure

function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, "")
}

/**
 * A "strict" complete HTML document is one that starts at the very first
 * non-whitespace character with `<!DOCTYPE` or `<html` and ends at the last
 * non-whitespace character with `</html>`. This is what the editor expects
 * to render directly without any further extraction.
 */
function isStrictCompleteHtmlDocument(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^(?:<!DOCTYPE|<html\b)/i.test(trimmed)) return false
  if (!/<\/html>\s*$/i.test(trimmed)) return false
  return isCompleteHtmlDocument(trimmed)
}

function tryStrictPassthrough(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) return null
  return isStrictCompleteHtmlDocument(trimmed) ? trimmed : null
}

/**
 * Extract every complete HTML document substring (non-overlapping, lazy
 * match). Returns the longest one — this is robust against narration that
 * happens to mention `<html>` and against multiple fenced examples where the
 * latest one is the actual answer.
 */
function tryExtractCompleteDocument(content: string): string | null {
  const candidates: string[] = []

  const collect = (regex: RegExp) => {
    const flagged = regex.flags.includes("g") ? regex : new RegExp(regex.source, `${regex.flags}g`)
    let match: RegExpExecArray | null
    while ((match = flagged.exec(content)) !== null) {
      const candidate = match[0].trim()
      if (isStrictCompleteHtmlDocument(candidate)) {
        candidates.push(candidate)
      }
      // Avoid infinite loops on zero-length matches.
      if (match.index === flagged.lastIndex) {
        flagged.lastIndex += 1
      }
    }
  }

  collect(/<!DOCTYPE[\s\S]*?<\/html>/gi)
  collect(/<html\b[\s\S]*?<\/html>/gi)

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.length - a.length)
  return candidates[0]
}

function tryExtractFencedBlock(content: string): string | null {
  const candidates: string[] = []

  // Closed fenced blocks (preferred). Pick by largest valid HTML document.
  const closedFenceRegex = /```(?:html?|markup|xml)?[ \t]*\r?\n([\s\S]*?)```/gi
  let closedMatch: RegExpExecArray | null
  while ((closedMatch = closedFenceRegex.exec(content)) !== null) {
    const inner = closedMatch[1].trim()
    if (isStrictCompleteHtmlDocument(inner)) {
      candidates.push(inner)
    } else {
      const innerExtracted = tryExtractCompleteDocument(inner)
      if (innerExtracted) candidates.push(innerExtracted)
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.length - a.length)
    return candidates[0]
  }

  // Unterminated fenced block — common when the model hits max tokens just
  // before emitting the closing fence.
  const openFenceMatch = content.match(/```(?:html?|markup|xml)?[ \t]*\r?\n([\s\S]*)$/i)
  if (openFenceMatch) {
    const inner = openFenceMatch[1].trim()
    if (isStrictCompleteHtmlDocument(inner)) return inner
    const innerExtracted = tryExtractCompleteDocument(inner)
    if (innerExtracted) return innerExtracted
  }

  return null
}

interface PatchBlock {
  search: string
  replace: string
}

function extractPatchBlocks(content: string): PatchBlock[] {
  const escapedSearch = escapeRegExp(SEARCH_START)
  const escapedDivider = escapeRegExp(DIVIDER)
  const escapedReplace = escapeRegExp(REPLACE_END)

  const regex = new RegExp(
    `${escapedSearch}\\s*([\\s\\S]*?)${escapedDivider}\\s*([\\s\\S]*?)${escapedReplace}`,
    "g",
  )

  const blocks: PatchBlock[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      search: match[1].replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
      replace: match[2].replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
    })
  }

  return blocks
}

function tryApplyPatches(content: string, currentHtml: string): {
  html: string
  appliedPatchCount: number
} | null {
  const blocks = extractPatchBlocks(content)
  if (blocks.length === 0) return null

  const parser = new StreamParser({})
  let working = currentHtml
  let applied = 0

  for (const block of blocks) {
    const result = parser.applyPatch(working, block.search, block.replace, "index.html")
    if (result.success) {
      working = result.content
      applied += 1
    }
  }

  if (applied === 0 || working === currentHtml) return null
  if (!isStrictCompleteHtmlDocument(working)) return null

  return { html: working, appliedPatchCount: applied }
}

function tryApplyJsonDiffEdits(
  rawContent: string,
  currentHtml: string,
): { html: string; appliedPatchCount: number; skippedEdits: number } | null {
  const parsed = parseJsonDiff(rawContent)
  if (!parsed) return null

  const parser = new StreamParser({})
  let working = currentHtml
  let applied = 0

  for (const edit of parsed.edits) {
    const result = parser.applyPatch(working, edit.search, edit.replace, "index.html")
    if (result.success) {
      working = result.content
      applied += 1
    }
  }

  if (applied === 0 || working === currentHtml) return null
  if (!isStrictCompleteHtmlDocument(working)) return null

  return { html: working, appliedPatchCount: applied, skippedEdits: parsed.skipped }
}

export interface FinalizeFollowUpInput {
  rawContent: string
  currentHtml: string
  /**
   * When true, SEARCH/REPLACE patch application is elevated to the PRIMARY
   * strategy (tried before fenced-block and narration extraction). Use for
   * surgical edit mode where the model is explicitly asked to return patches.
   */
  preferPatches?: boolean
  /**
   * When true, JSON diff parsing is tried FIRST (before all other strategies).
   * Use when the model was prompted with JSON_DIFF_SYSTEM_PROMPT and
   * `responseFormat: { type: "json_object" }`. If JSON parsing fails or
   * patches don't apply, falls back to preferPatches / text strategies.
   */
  preferJsonDiff?: boolean
}

/**
 * Convert any reasonable model response into a complete HTML document.
 *
 * Strategy ordering (cheapest first):
 *   0. (If preferJsonDiff) Parse JSON diff edits and apply patches.
 *   1. Pass-through (already a strict complete document).
 *   2. Strip thinking tags, then re-check.
 *   3a. (If preferPatches) Apply SEARCH/REPLACE patches against prior HTML.
 *   3b. Unwrap fenced ```html block (handles both closed and unterminated).
 *   4. Extract complete document hidden inside narration.
 *   5. (If !preferPatches) Apply SEARCH/REPLACE patches against the prior HTML.
 *
 * On success, the returned HTML is guaranteed to satisfy
 * `isStrictCompleteHtmlDocument` AND has been run through `normalizeHtml`,
 * so callers can rely on byte-stable canonical output. This matters for
 * the `search-replace` strategy on the next reprompt: SEARCH blocks are
 * matched against the previously stored HTML, so any formatter drift
 * between requests would invalidate patches.
 *
 * Callers should keep `currentHtml` as the source of truth on failure.
 */
export function finalizeFollowUpResponse(
  input: FinalizeFollowUpInput,
): FollowUpFinalizerResult {
  const cleaned = stripBom(input.rawContent ?? "")
  if (!cleaned.trim()) {
    return { ok: false, reason: "The model returned an empty response." }
  }

  // ── JSON diff strategy (primary when preferJsonDiff is set) ──
  // Try first, before passthrough, because JSON-mode output is never a
  // raw HTML document. If parsing or patch application fails, fall through
  // to the text-based strategies below.
  if (input.preferJsonDiff && input.currentHtml && isStrictCompleteHtmlDocument(input.currentHtml)) {
    const jsonDiffed = tryApplyJsonDiffEdits(cleaned, input.currentHtml)
    if (jsonDiffed) {
      return {
        ok: true,
        html: normalizeHtml(jsonDiffed.html),
        strategy: "json-diff",
        appliedPatchCount: jsonDiffed.appliedPatchCount,
        diffCompliant: true,
      }
    }
  }

  const passthrough = tryStrictPassthrough(cleaned)
  if (passthrough) {
    return {
      ok: true,
      html: normalizeHtml(passthrough),
      strategy: "passthrough",
      diffCompliant: input.preferPatches ? false : undefined,
    }
  }

  const withoutThinking = stripThinkingBlocks(cleaned).trim()
  if (withoutThinking && withoutThinking !== cleaned.trim()) {
    const passthroughAfterThink = tryStrictPassthrough(withoutThinking)
    if (passthroughAfterThink) {
      return {
        ok: true,
        html: normalizeHtml(passthroughAfterThink),
        strategy: "stripped-thinking",
        diffCompliant: input.preferPatches ? false : undefined,
      }
    }
  }

  const candidate = withoutThinking || cleaned

  // When preferPatches is set (surgical mode), try SEARCH/REPLACE patches
  // before fenced-block and narration extraction. The model was explicitly
  // asked for patches, so patches are the primary strategy.
  if (input.preferPatches && input.currentHtml && isStrictCompleteHtmlDocument(input.currentHtml)) {
    const patched = tryApplyPatches(candidate, input.currentHtml)
    if (patched) {
      return {
        ok: true,
        html: normalizeHtml(patched.html),
        strategy: "search-replace",
        appliedPatchCount: patched.appliedPatchCount,
        diffCompliant: true,
      }
    }
  }

  // Fenced blocks before raw narration extraction: when models include
  // multiple fenced examples, the fenced block is the canonical answer.
  const fenced = tryExtractFencedBlock(candidate)
  if (fenced) {
    return {
      ok: true,
      html: normalizeHtml(fenced),
      strategy: "fenced-block",
      diffCompliant: input.preferPatches ? false : undefined,
    }
  }

  const extracted = tryExtractCompleteDocument(candidate)
  if (extracted) {
    return {
      ok: true,
      html: normalizeHtml(extracted),
      strategy: "extracted-from-narration",
      diffCompliant: input.preferPatches ? false : undefined,
    }
  }

  // Non-preferPatches: try patches as a last resort after extraction.
  if (!input.preferPatches && input.currentHtml && isStrictCompleteHtmlDocument(input.currentHtml)) {
    const patched = tryApplyPatches(candidate, input.currentHtml)
    if (patched) {
      return {
        ok: true,
        html: normalizeHtml(patched.html),
        strategy: "search-replace",
        appliedPatchCount: patched.appliedPatchCount,
        diffCompliant: true,
      }
    }
  }

  // No strategy succeeded. Surface the closest hint we have.
  if (candidate.includes(SEARCH_START)) {
    return {
      ok: false,
      reason: "The model returned patches that could not be applied to the current page.",
    }
  }

  if (/<\/?html\b/i.test(candidate) || /<!DOCTYPE/i.test(candidate)) {
    return {
      ok: false,
      reason: "The model returned an incomplete HTML document.",
    }
  }

  return {
    ok: false,
    reason: "The model response did not contain a usable HTML update.",
  }
}
