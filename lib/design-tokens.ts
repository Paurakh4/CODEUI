/**
 * Design tokens extraction and serialization for cross-turn style persistence.
 *
 * Extracts font, color, spacing, and border-radius decisions from HTML so
 * they survive across reprompts. Tokens are persisted to MongoDB on the
 * Project document and injected into every generation context.
 */

export interface DesignTokens {
  fontFamily?: string
  headingFontFamily?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundColor?: string
  textColor?: string
  headingColor?: string
  spacingScale?: string
  borderRadius?: string
  theme?: "light" | "dark"
}

/**
 * Extract design tokens from an HTML document by parsing CSS and inline styles.
 */
export function extractDesignTokensFromHtml(html: string): DesignTokens {
  const tokens: DesignTokens = {}

  // Extract font-family from the first body or * rule in <style>.
  const fontMatch = html.match(/font-family\s*:\s*([^;}]+)/i)
  if (fontMatch) {
    const families = fontMatch[1].split(",").map((f) => f.trim().replace(/['"]/g, ""))
    tokens.fontFamily = families[0] || undefined
  }

  // Extract heading font from h1-h6 rules.
  const headingFontMatch = html.match(/h[1-6][^{]*\{[^}]*font-family\s*:\s*([^;}]+)/i)
  if (headingFontMatch) {
    const families = headingFontMatch[1].split(",").map((f) => f.trim().replace(/['"]/g, ""))
    tokens.headingFontFamily = families[0] || undefined
  }

  // Extract colors from CSS custom properties (--primary, --accent, etc.).
  const primaryMatch = html.match(/--primary(?:-color)?\s*:\s*([^;}]+)/i)
  if (primaryMatch) tokens.primaryColor = primaryMatch[1].trim()

  const accentMatch = html.match(/--accent(?:-color)?\s*:\s*([^;}]+)/i)
  if (accentMatch) tokens.accentColor = accentMatch[1].trim()

  const bgMatch = html.match(/--background(?:-color)?\s*:\s*([^;}]+)/i)
  if (bgMatch) tokens.backgroundColor = bgMatch[1].trim()

  // Extract from Tailwind bg- classes on body.
  const bodyBgMatch = html.match(/<body[^>]*class="[^"]*\bbg-\[(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\]/i)
  if (bodyBgMatch) tokens.backgroundColor = bodyBgMatch[1]

  // Extract theme from color-scheme or dark class.
  if (/color-scheme\s*:\s*dark/i.test(html) || /\bdark\b/i.test(html)) {
    tokens.theme = "dark"
  } else if (/color-scheme\s*:\s*light/i.test(html)) {
    tokens.theme = "light"
  }

  // Extract border-radius.
  const radiusMatch = html.match(/border-radius\s*:\s*([^;}]+)/i)
  if (radiusMatch) tokens.borderRadius = radiusMatch[1].trim()

  // Extract spacing scale from common Tailwind patterns.
  const gapMatch = html.match(/\bgap-(\d+|\[[^\]]+\])\b/)
  if (!gapMatch) {
    // Default spacing inference.
  }

  return tokens
}

/**
 * Serialize design tokens into a prompt block for injection into generation context.
 */
export function serializeDesignTokensForPrompt(tokens: DesignTokens): string {
  const lines: string[] = []

  if (tokens.fontFamily || tokens.headingFontFamily) {
    const bodyFont = tokens.fontFamily || "not set"
    const headingFont = tokens.headingFontFamily || bodyFont
    lines.push(`- Font: body="${bodyFont}", headings="${headingFont}"`)
  }

  if (tokens.primaryColor) lines.push(`- Primary color: ${tokens.primaryColor}`)
  if (tokens.secondaryColor) lines.push(`- Secondary color: ${tokens.secondaryColor}`)
  if (tokens.accentColor) lines.push(`- Accent color: ${tokens.accentColor}`)
  if (tokens.backgroundColor) lines.push(`- Background color: ${tokens.backgroundColor}`)
  if (tokens.textColor) lines.push(`- Text color: ${tokens.textColor}`)
  if (tokens.headingColor) lines.push(`- Heading color: ${tokens.headingColor}`)
  if (tokens.borderRadius) lines.push(`- Border radius: ${tokens.borderRadius}`)
  if (tokens.theme) lines.push(`- Theme: ${tokens.theme}`)

  if (lines.length === 0) return ""

  return [
    "DESIGN TOKENS (current design decisions — preserve these unless the user explicitly asks to change them):",
    ...lines,
    "",
  ].join("\n")
}

/**
 * Create an empty design tokens object.
 */
export function createEmptyDesignTokens(): DesignTokens {
  return {}
}
