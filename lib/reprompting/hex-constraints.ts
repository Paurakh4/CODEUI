/**
 * Hex color hard-constraint extraction and enforcement.
 *
 * When a user specifies an exact hex color (e.g. #000000, #ffffff), treat it
 * as a hard constraint: pass it through verbatim to the model and verify it
 * appears in the output.
 */

interface HexConstraint {
  /** The exact hex value, e.g. "#000000". */
  value: string
  /** The context word near the hex, e.g. "background", "text", "border". */
  context: string
}

/**
 * Extract hex color constraints from a user prompt.
 * Returns an array of { value, context } pairs.
 */
export function extractHexConstraints(prompt: string): HexConstraint[] {
  const results: HexConstraint[] = []
  const seen = new Set<string>()

  // Match exact hex values with optional surrounding context words.
  const hexRegex = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g
  let match: RegExpExecArray | null

  while ((match = hexRegex.exec(prompt)) !== null) {
    const value = match[0].toLowerCase()
    if (seen.has(value)) continue
    seen.add(value)

    // Find the nearest context word before the hex (up to 20 chars back).
    const before = prompt.slice(Math.max(0, match.index - 40), match.index)
    const contextMatch = before.match(/(background|bg|text|color|border|accent|fill|stroke|header|body|card|button|link|hover)\s*$/i)
    const context = contextMatch ? contextMatch[1].toLowerCase() : "color"

    results.push({ value, context })
  }

  return results
}

/**
 * Build a hard-constraint block to append to the user message.
 */
export function buildHexConstraintBlock(constraints: HexConstraint[]): string {
  if (constraints.length === 0) return ""

  const lines = constraints.map(
    (c) => `- ${c.context} MUST be ${c.value} (exact value, verbatim — do NOT substitute or interpret)`,
  )

  return [
    "",
    "HARD COLOR CONSTRAINTS (use verbatim, do NOT substitute or interpret):",
    ...lines,
  ].join("\n")
}

/**
 * Check whether all hex constraints are present in the output HTML.
 * Returns the list of missing hex values.
 */
export function checkHexConstraintsInOutput(
  constraints: HexConstraint[],
  html: string,
): string[] {
  const lower = html.toLowerCase()
  return constraints
    .filter((c) => !lower.includes(c.value))
    .map((c) => c.value)
}
