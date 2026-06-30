/**
 * Parser for structured JSON diff output from LLMs.
 *
 * When the model is prompted with JSON_DIFF_SYSTEM_PROMPT and
 * `responseFormat: { type: "json_object" }`, it returns a JSON object
 * like:
 *
 *   {"edits":[{"search":"...","replace":"..."}]}
 *
 * This module extracts the edits, validates their shape, and converts
 * them into PatchBlock[] that can be fed to StreamParser.applyPatch —
 * the same patch engine used by the SEARCH/REPLACE text strategy.
 *
 * Graceful degradation:
 *   1. Direct JSON.parse (fast path — provider enforced JSON mode).
 *   2. Strip markdown fences / thinking tags, then JSON.parse.
 *   3. Extract the outermost { ... } substring, then JSON.parse.
 *   4. If all fail, return null (caller falls back to text strategies).
 */

import { stripThinkingBlocks } from "./thinking-stripper"

export interface JsonDiffEdit {
  search: string
  replace: string
}

export interface JsonDiffParseResult {
  edits: JsonDiffEdit[]
  /** Number of edits that were dropped due to invalid shape. */
  skipped: number
}

/**
 * Parse raw model output into a list of JSON diff edits.
 *
 * Returns null if no valid JSON object with an "edits" array could be
 * extracted. The caller should then fall back to SEARCH/REPLACE text
 * or full-document extraction strategies.
 */
export function parseJsonDiff(rawContent: string): JsonDiffParseResult | null {
  if (!rawContent || !rawContent.trim()) return null

  const json = tryParseJson(rawContent)
  if (json === null) return null

  return extractEdits(json)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function tryParseJson(content: string): unknown | null {
  // 1. Direct parse — the fast path when the provider enforces JSON mode.
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // continue to fallbacks
  }

  // 2. Strip thinking tags and markdown fences, then retry.
  const withoutThinking = stripThinkingBlocks(content).trim()
  if (withoutThinking && withoutThinking !== trimmed) {
    const deFenced = stripCodeFences(withoutThinking)
    try {
      return JSON.parse(deFenced)
    } catch {
      // continue
    }
  }

  // 3. Strip code fences from the original content.
  const deFencedOriginal = stripCodeFences(trimmed)
  if (deFencedOriginal !== trimmed) {
    try {
      return JSON.parse(deFencedOriginal)
    } catch {
      // continue
    }
  }

  // 4. Extract the outermost { ... } substring.
  const start = withoutThinking.indexOf("{")
  const end = withoutThinking.lastIndexOf("}")
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(withoutThinking.slice(start, end + 1))
    } catch {
      // continue
    }
  }

  // 5. Try the same extraction on the original content.
  const startOrig = trimmed.indexOf("{")
  const endOrig = trimmed.lastIndexOf("}")
  if (startOrig !== -1 && endOrig !== -1 && endOrig > startOrig) {
    try {
      return JSON.parse(trimmed.slice(startOrig, endOrig + 1))
    } catch {
      // give up
    }
  }

  return null
}

function stripCodeFences(content: string): string {
  return content
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim()
}

function extractEdits(json: unknown): JsonDiffParseResult | null {
  if (!json || typeof json !== "object") return null

  const record = json as Record<string, unknown>
  const editsRaw = record.edits

  if (!Array.isArray(editsRaw)) return null

  const edits: JsonDiffEdit[] = []
  let skipped = 0

  for (const item of editsRaw) {
    if (!item || typeof item !== "object") {
      skipped += 1
      continue
    }

    const edit = item as Record<string, unknown>
    const search = typeof edit.search === "string" ? edit.search : null
    const replace = typeof edit.replace === "string" ? edit.replace : null

    if (search === null || replace === null) {
      skipped += 1
      continue
    }

    // Skip empty search blocks — they're invalid for patch application.
    if (search.trim() === "" && replace.trim() === "") {
      skipped += 1
      continue
    }

    edits.push({ search, replace })
  }

  if (edits.length === 0) return null

  return { edits, skipped }
}
