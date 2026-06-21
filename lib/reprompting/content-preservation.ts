/**
 * Content preservation for reprompting — prevents the AI from wiping existing
 * visible text content on style-only or vague reprompts.
 *
 * Strategy: post-generation content-presence diff. Extract visible text nodes
 * from old and new HTML, diff them. If significant content vanished on a
 * style-only prompt, reject the generation and restore the previous version.
 */

/** Strip HTML tags, scripts, styles, and collapse whitespace to get plain text. */
function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[#\w]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extract meaningful visible text tokens from an HTML document.
 * Filters out single characters, empty strings, and pure-whitespace.
 * Returns unique normalized tokens.
 */
export function extractVisibleContent(html: string): string[] {
  const plain = stripHtmlToPlainText(html)
  if (!plain) return []

  // Split on word boundaries, keep tokens ≥ 2 chars, deduplicate.
  const tokens = plain
    .split(/[^a-zA-Z0-9$€£¥.,!?%#@&*()\-–—/\\+='"«»„"‹›]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)

  return [...new Set(tokens)]
}

/**
 * Check if a token looks like a price or numeric data point that should
 * never be silently lost.
 */
function isPriceLikeToken(token: string): boolean {
  // $9, $29, $99/mo, €49, £10, 500 USD, etc.
  return /^[\$€£¥]\d+|^\d+\s*(?:USD|EUR|GBP|JPY|CNY|INR|cents?|dollars?)/i.test(token) ||
    /^\d+[kKmMbB]?\+?$/.test(token) ||
    /^(?:free|custom|enterprise|starter|pro|basic|premium|standard|business|team|individual|personal)$/i.test(token)
}

/**
 * Diff two sets of visible content tokens.
 * Returns tokens present in `before` but missing from `after`.
 */
export function diffLostContent(before: string[], after: string[]): string[] {
  const afterSet = new Set(after.map((t) => t.toLowerCase()))
  return before.filter((t) => !afterSet.has(t.toLowerCase()))
}

/**
 * Returns true if the prompt is likely style-only (color, font, spacing,
 * layout) and should NOT touch text content.
 */
export function isStyleOnlyPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim()
  if (!lower) return false

  // Content-modification signals — if any present, NOT style-only.
  const contentSignals = [
    /\b(?:add|remove|delete|restore|bring\s+back|put\s+back|change|update|replace|edit|fix|correct|rewrite|modify|rename|reword|rephrase)\s+(?:the\s+)?(?:heading|headline|title|text|copy|subtitle|tagline|label|description|paragraph|sentence|word|wording|name|plan|price|bullet|list|content)\b/i,
    /\b(?:heading|headline|title|text|copy|subtitle|tagline|label|description|plan\s+name|price|bullet)\s+(?:change|update|edit|fix)\b/i,
    /\b(?:rename|reword|rephrase|restore|bring\s+back)\b/i,
    /\badd\s+(?:a\s+|an\s+|the\s+)?(?:section|component|card|panel|block|module|widget|form|modal|navbar|footer|header|sidebar|faq|testimonial|pricing|hero|gallery|contact)\b/i,
    /\bremove\s+(?:the\s+)?(?:section|component|card)\b/i,
    /\bcontent\b/i,
  ]

  if (contentSignals.some((p) => p.test(lower))) return false

  // Style-only signals — must match at least one.
  const styleSignals = [
    /\b(?:color|theme|palette|accent|scheme|dark|light)\b/i,
    /\b(?:font|typography|typeface|garamond|helvetica|arial|sans|serif|mono)\b/i,
    /\b(?:spacing|margin|padding|gap|width|height|size)\b/i,
    /\b(?:border|radius|rounded|shadow|gradient)\b/i,
    /\b(?:background|bg)\b/i,
    /\b(?:layout|grid|flex|stack|horizontal|vertical|side.by.side)\b/i,
    /\b(?:animation|transition|hover|effect)\b/i,
    /\b(?:style|design|look|feel|aesthetic|visual)\b/i,
    /\b(?:better|improve|polish|refine|tweak|tighten)\b/i,
    /#[0-9a-fA-F]{3,6}\b/,
  ]

  return styleSignals.some((p) => p.test(lower))
}

export interface ContentPreservationResult {
  /** True if content was preserved (or no check needed). */
  preserved: boolean
  /** Tokens lost from the before set. */
  lostTokens: string[]
  /** Price-like tokens that were lost (always triggers rejection). */
  lostPriceTokens: string[]
  /** Percentage of before-tokens lost (0-1). */
  lossRatio: number
}

/**
 * Check whether content was preserved between two HTML versions.
 * Returns a detailed result.
 *
 * Thresholds:
 * - Any price-like token lost → rejected.
 * - >30% of before-tokens lost → rejected.
 */
export function checkContentPreservation(
  beforeHtml: string,
  afterHtml: string,
): ContentPreservationResult {
  const before = extractVisibleContent(beforeHtml)
  const after = extractVisibleContent(afterHtml)

  if (before.length === 0) {
    return { preserved: true, lostTokens: [], lostPriceTokens: [], lossRatio: 0 }
  }

  const lost = diffLostContent(before, after)
  const lostPriceTokens = lost.filter(isPriceLikeToken)
  const lossRatio = lost.length / before.length

  const preserved = lostPriceTokens.length === 0 && lossRatio <= 0.3

  return { preserved, lostTokens: lost, lostPriceTokens, lossRatio }
}
