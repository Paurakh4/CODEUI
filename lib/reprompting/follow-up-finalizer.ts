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
import { escapeRegExp } from "@/lib/utils/regex-helper"

export type FollowUpFinalizerStrategy =
  | "passthrough"
  | "stripped-thinking"
  | "extracted-from-narration"
  | "fenced-block"
  | "search-replace"

export interface FollowUpFinalizerSuccess {
  ok: true
  html: string
  strategy: FollowUpFinalizerStrategy
  appliedPatchCount?: number
}

export interface FollowUpFinalizerFailure {
  ok: false
  reason: string
}

export type FollowUpFinalizerResult =
  | FollowUpFinalizerSuccess
  | FollowUpFinalizerFailure

const THINKING_TAG_PATTERNS: RegExp[] = [
  /<think(?:ing)?[^>]*>[\s\S]*?<\/think(?:ing)?>/gi,
  /<reasoning[^>]*>[\s\S]*?<\/reasoning>/gi,
  /<reflection[^>]*>[\s\S]*?<\/reflection>/gi,
  /<analysis[^>]*>[\s\S]*?<\/analysis>/gi,
  /<scratchpad[^>]*>[\s\S]*?<\/scratchpad>/gi,
]

// When output is truncated mid-thought, providers can leave an unmatched
// opening tag. Drop everything from the open tag up to the first DOCTYPE/html.
const UNCLOSED_THINKING_PATTERNS: RegExp[] = [
  /<think(?:ing)?[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<reasoning[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<reflection[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<analysis[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
  /<scratchpad[^>]*>[\s\S]*?(?=<!DOCTYPE|<html\b)/i,
]

function stripThinkingBlocks(content: string): string {
  let result = content
  for (const pattern of THINKING_TAG_PATTERNS) {
    result = result.replace(pattern, "")
  }
  for (const pattern of UNCLOSED_THINKING_PATTERNS) {
    result = result.replace(pattern, "")
  }
  return result
}

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

export interface FinalizeFollowUpInput {
  rawContent: string
  currentHtml: string
}

/**
 * Convert any reasonable model response into a complete HTML document.
 *
 * Strategy ordering (cheapest first):
 *   1. Pass-through (already a strict complete document).
 *   2. Strip thinking tags, then re-check.
 *   3. Unwrap fenced ```html block (handles both closed and unterminated).
 *   4. Extract complete document hidden inside narration.
 *   5. Apply SEARCH/REPLACE patches against the prior HTML.
 *
 * On success, the returned HTML is guaranteed to satisfy
 * `isStrictCompleteHtmlDocument` — i.e., the editor can render it directly.
 * Callers should keep `currentHtml` as the source of truth on failure.
 */
export function finalizeFollowUpResponse(
  input: FinalizeFollowUpInput,
): FollowUpFinalizerResult {
  const cleaned = stripBom(input.rawContent ?? "")
  if (!cleaned.trim()) {
    return { ok: false, reason: "The model returned an empty response." }
  }

  const passthrough = tryStrictPassthrough(cleaned)
  if (passthrough) {
    return { ok: true, html: passthrough, strategy: "passthrough" }
  }

  const withoutThinking = stripThinkingBlocks(cleaned).trim()
  if (withoutThinking && withoutThinking !== cleaned.trim()) {
    const passthroughAfterThink = tryStrictPassthrough(withoutThinking)
    if (passthroughAfterThink) {
      return { ok: true, html: passthroughAfterThink, strategy: "stripped-thinking" }
    }
  }

  const candidate = withoutThinking || cleaned

  // Fenced blocks before raw narration extraction: when models include
  // multiple fenced examples, the fenced block is the canonical answer.
  const fenced = tryExtractFencedBlock(candidate)
  if (fenced) {
    return { ok: true, html: fenced, strategy: "fenced-block" }
  }

  const extracted = tryExtractCompleteDocument(candidate)
  if (extracted) {
    return { ok: true, html: extracted, strategy: "extracted-from-narration" }
  }

  if (input.currentHtml && isStrictCompleteHtmlDocument(input.currentHtml)) {
    const patched = tryApplyPatches(candidate, input.currentHtml)
    if (patched) {
      return {
        ok: true,
        html: patched.html,
        strategy: "search-replace",
        appliedPatchCount: patched.appliedPatchCount,
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
