/**
 * Prompt normalizer — converts both vague and specific prompts into
 * comparable structured intent strings.
 *
 * This prevents the inconsistency where vague prompts sometimes outperform
 * specific prompts because the model interprets them differently.
 * By extracting structured intent from both, we get consistent results.
 */

export interface NormalizedIntent {
  /** The structured intent string to pass to the model. */
  structured: string
  /** Whether the original prompt was vague. */
  isVague: boolean
  /** Extracted action verbs. */
  actions: string[]
  /** Extracted scope/target nouns. */
  scope: string[]
  /** Extracted constraints (hex colors, specific values). */
  constraints: string[]
}

const ACTION_VERBS = [
  "add", "remove", "change", "update", "replace", "improve", "polish",
  "refine", "tweak", "adjust", "redesign", "restyle", "make", "set",
  "apply", "convert", "switch", "turn", "reorder", "rearrange", "fix",
  "enhance", "upgrade", "simplify", "tighten", "restore", "bring back",
]

const SCOPE_NOUNS = [
  "layout", "spacing", "typography", "font", "color", "palette", "theme",
  "background", "text", "heading", "button", "card", "section", "navbar",
  "header", "footer", "hero", "pricing", "testimonial", "faq", "gallery",
  "form", "input", "modal", "sidebar", "animation", "interaction", "hover",
  "border", "radius", "shadow", "gradient", "content", "copy", "price",
  "plan", "feature", "bullet", "list", "grid", "flex", "stack",
]

const CONSTRAINT_PATTERNS = [
  /#[0-9a-fA-F]{3,6}\b/g,
  /\$\d+/g,
  /\b\d+px\b/g,
  /\b\d+rem\b/g,
  /\b(?:EB\s+Garamond|Inter|Roboto|Open\s+Sans|Montserrat|Playfair|Georgia|Helvetica|Arial|system\s+ui)\b/gi,
]

/**
 * Extract actions, scope, and constraints from a prompt.
 */
export function normalizePromptIntent(prompt: string): NormalizedIntent {
  const lower = prompt.toLowerCase().trim()
  const words = lower.split(/\s+/)

  // Extract actions.
  const actions = ACTION_VERBS.filter((v) =>
    new RegExp(`\\b${v}\\b`, "i").test(lower),
  )

  // Extract scope.
  const scope = SCOPE_NOUNS.filter((n) =>
    new RegExp(`\\b${n}\\b`, "i").test(lower),
  )

  // Extract constraints.
  const constraints: string[] = []
  for (const pattern of CONSTRAINT_PATTERNS) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(prompt)) !== null) {
      constraints.push(match[0])
    }
  }

  // Determine if vague.
  const isVague = actions.length === 0 ||
    (actions.length === 1 && ["improve", "polish", "refine", "tweak", "enhance", "upgrade", "make"].includes(actions[0]) && scope.length <= 2)

  // Build structured intent string.
  const parts: string[] = []

  if (actions.length > 0) {
    parts.push(`Intent: ${actions.join("/")}`)
  } else {
    parts.push("Intent: modify")
  }

  if (scope.length > 0) {
    parts.push(`Scope: ${scope.join(", ")}`)
  } else {
    parts.push("Scope: general visual improvement")
  }

  if (constraints.length > 0) {
    parts.push(`Constraints: ${constraints.join(", ")}`)
  }

  parts.push("Preserve: all existing content, layout, and design decisions not mentioned in the request.")
  parts.push(`Original request: ${prompt.trim()}`)

  return {
    structured: parts.join(". "),
    isVague,
    actions,
    scope,
    constraints,
  }
}
