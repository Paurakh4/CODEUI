/**
 * Multi-part prompt splitter for reprompting.
 *
 * When a user sends a prompt containing both style and content instructions
 * (e.g. "add back plan names AND change font to EB Garamond"), split it into
 * ordered scoped sub-prompts. Process style first, then content, so both
 * are applied correctly.
 */

export interface SplitPrompt {
  /** The sub-prompt text. */
  text: string
  /** Classification: style-only or content. */
  kind: "style" | "content" | "mixed"
}

/**
 * Split a prompt on common connectors into sub-prompts.
 * Returns an array of { text, kind }.
 */
export function splitMultiPartPrompt(prompt: string): SplitPrompt[] {
  const trimmed = prompt.trim()
  if (!trimmed) return []

  // Connectors: "and also", "and", "also", ";", "plus", "then", "additionally".
  // We split on these but only when they appear between clauses (not inside
  // quoted strings or parenthetical groups).
  const connectorRegex = /\s+(?:and\s+also|and|also|plus|then|additionally)\s+(?=(?:[^"']|"[^"]*"|'[^']*')*$)/gi

  const parts = trimmed.split(connectorRegex).filter((p) => p.trim().length > 0)

  if (parts.length <= 1) {
    return [{ text: trimmed, kind: classifySubPrompt(trimmed) }]
  }

  return parts.map((p) => ({
    text: p.trim(),
    kind: classifySubPrompt(p.trim()),
  }))
}

/**
 * Classify a sub-prompt as style, content, or mixed.
 */
function classifySubPrompt(prompt: string): SplitPrompt["kind"] {
  const lower = prompt.toLowerCase()

  const styleSignals = [
    /\b(?:color|theme|palette|accent|scheme|dark|light|background|bg)\b/i,
    /\b(?:font|typography|typeface|garamond|helvetica|arial|sans|serif|mono|system\s+ui)\b/i,
    /\b(?:spacing|margin|padding|gap|width|height|size)\b/i,
    /\b(?:border|radius|rounded|shadow|gradient)\b/i,
    /\b(?:layout|grid|flex|stack|horizontal|vertical|side.by.side)\b/i,
    /\b(?:animation|transition|hover|effect)\b/i,
    /\b(?:style|design|look|feel|aesthetic|visual)\b/i,
    /#[0-9a-fA-F]{3,6}\b/,
  ]

  const contentSignals = [
    /\b(?:add|remove|restore|bring\s+back|put\s+back)\s+(?:the\s+)?(?:heading|headline|title|text|copy|subtitle|tagline|label|description|paragraph|sentence|word|wording|name|plan|price|bullet|list|content)\b/i,
    /\b(?:heading|headline|title|text|copy|subtitle|tagline|label|description|plan\s+name|price|bullet)\s+(?:change|update|edit|fix)\b/i,
    /\b(?:rename|reword|rephrase|restore|bring\s+back)\b/i,
    /\b(?:plan\s+name|price|feature\s+list|bullet)\b/i,
    /\b(?:starter|professional|enterprise|basic|premium|business)\b/i,
    /\$\d+/,
  ]

  const hasStyle = styleSignals.some((p) => p.test(lower))
  const hasContent = contentSignals.some((p) => p.test(lower))

  if (hasStyle && hasContent) return "mixed"
  if (hasContent) return "content"
  if (hasStyle) return "style"
  return "mixed" // Default to mixed when uncertain.
}

/**
 * Returns true if the prompt should be split and processed sequentially.
 * True when there are ≥2 sub-prompts with at least one style and one content.
 */
export function shouldSplitPrompt(prompt: string): boolean {
  const parts = splitMultiPartPrompt(prompt)
  if (parts.length < 2) return false

  const kinds = new Set(parts.map((p) => p.kind))
  return kinds.has("style") && kinds.has("content")
}
