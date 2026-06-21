/**
 * No-op detection for follow-up reprompts.
 *
 * Before running a full (expensive) follow-up generation, check whether the
 * current HTML already satisfies the user's request. If it does, we skip the
 * upstream call entirely and return a confirmation message.
 *
 * Two tiers:
 *   1. Heuristic fast-path — lightweight rule checks for obvious cases
 *      (layout orientation, theme color). No LLM call needed.
 *   2. LLM check — asks a fast/cheap model a yes/no question. Only called
 *      when the heuristic is uncertain.
 */

/** Strip HTML tags, scripts, and styles to get plain text. */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Heuristic fast-path: check if the current HTML already satisfies common
 * no-op requests without making an LLM call.
 *
 * Returns `true` if we're confident the request is already satisfied,
 * `false` if uncertain (should fall through to LLM check),
 * `null` if we're confident it's NOT satisfied (skip LLM check too).
 */
export function heuristicAlreadySatisfied(prompt: string, html: string): boolean | null {
  const lower = prompt.toLowerCase().trim()
  const htmlLower = html.toLowerCase()

  // "make X horizontal" / "side by side" — check if flex-row layout exists.
  if (/\b(?:horizontal|side.by.side|sidebyside|row)\b/i.test(lower)) {
    const hasFlexRow = /\bflex-row\b/i.test(htmlLower) ||
      /class="[^"]*\bflex\b[^"]*\b(?:flex-row|lg:flex-row)\b/i.test(htmlLower) ||
      /\bdisplay:\s*flex\b/i.test(htmlLower)
    if (hasFlexRow) return true
    // If it's a grid layout, that's also horizontal-ish.
    const hasGrid = /\bgrid-cols-/i.test(htmlLower) || /\bdisplay:\s*grid\b/i.test(htmlLower)
    if (hasGrid) return true
  }

  // "make X vertical" / "stack" — check if flex-col / block layout exists.
  if (/\b(?:vertical|stack|stacked)\b/i.test(lower)) {
    const hasFlexCol = /\bflex-col\b/i.test(htmlLower) ||
      /class="[^"]*\bflex\b[^"]*\bflex-col\b/i.test(htmlLower)
    if (hasFlexCol) return true
  }

  // "dark theme" / "dark mode" — check for dark color-scheme or dark bg.
  if (/\bdark\s+(?:theme|mode)\b/i.test(lower)) {
    const hasDark = /color-scheme:\s*dark/i.test(htmlLower) ||
      /\b(?:bg-black|bg-zinc-900|bg-zinc-950|bg-neutral-900|bg-slate-900|bg-gray-900)\b/i.test(htmlLower) ||
      /class="[^"]*\b(?:dark)\b/i.test(htmlLower)
    if (hasDark) return true
  }

  // "light theme" / "light mode" — check for light color-scheme or light bg.
  if (/\blight\s+(?:theme|mode)\b/i.test(lower)) {
    const hasLight = /color-scheme:\s*light/i.test(htmlLower) ||
      /\b(?:bg-white|bg-zinc-50|bg-stone-50|bg-slate-50|bg-gray-50)\b/i.test(htmlLower)
    if (hasLight) return true
  }

  // If the prompt is very short and contains only words that appear in the
  // visible text of the page, it's likely already satisfied.
  const strippedHtml = stripHtmlTags(htmlLower)
  const promptWords = lower.split(/\s+/).filter((w) => w.length > 3)
  if (promptWords.length >= 2 && promptWords.length <= 6) {
    const allFound = promptWords.every((w) => strippedHtml.includes(w))
    if (allFound) return true
  }

  // Not confident either way — fall through to LLM check.
  return false
}

/**
 * Build the LLM prompt for no-op checking.
 */
export function buildNoopCheckPrompt(prompt: string): string {
  return [
    'You are checking whether a user request is already satisfied by the current HTML page.',
    'Reply ONLY "YES" or "NO".',
    '',
    `User request: "${prompt}"`,
    '',
    'Does the current page already fully satisfy this request?',
    'Consider: if the user asks to "make X horizontal" and X is already in a horizontal/flex-row/grid layout, answer YES.',
    'If the user asks for a dark theme and the page already has a dark background/color-scheme, answer YES.',
    'If the request would require ANY change to the page, answer NO.',
    'Be conservative — answer NO if unsure.',
    '',
    'Answer (YES or NO):',
  ].join("\n")
}

/**
 * Parse the LLM response for no-op checking.
 * Returns `true` if the model says YES, `false` otherwise.
 */
export function parseNoopCheckResponse(response: string): boolean {
  const trimmed = response.trim().toUpperCase()
  // The first word should be YES or NO.
  if (/^YES\b/.test(trimmed)) return true
  if (/^NO\b/.test(trimmed)) return false
  // Fallback: check if YES appears anywhere significant.
  return /\bYES\b/.test(trimmed) && !/\bNO\b/.test(trimmed)
}
