const ENHANCED_PROMPT_REQUIREMENTS_HEADING = "Requirements:"
const ENHANCED_PROMPT_BASE_REQUIREMENT = "- Make it production-ready and responsive."

interface BuildEnhancedPromptOptions {
  prompt: string
  enhancedPrompts?: boolean
  primaryColor?: string
  secondaryColor?: string
  theme?: "light" | "dark"
}

export function isEnhancedPrompt(prompt: string): boolean {
  const normalizedPrompt = prompt.trim()

  return (
    normalizedPrompt.includes(`\n\n${ENHANCED_PROMPT_REQUIREMENTS_HEADING}\n${ENHANCED_PROMPT_BASE_REQUIREMENT}`) &&
    /- Use a (light|dark) theme direction\./i.test(normalizedPrompt) &&
    /- Use .+ as the primary color family and .+ as the secondary color family\./i.test(normalizedPrompt)
  )
}

export function buildEnhancedPrompt({
  prompt,
  enhancedPrompts,
  primaryColor,
  secondaryColor,
  theme,
}: BuildEnhancedPromptOptions): string {
  const trimmedPrompt = prompt.trim()

  if (!trimmedPrompt) {
    return ""
  }

  if (!enhancedPrompts || isEnhancedPrompt(trimmedPrompt)) {
    return trimmedPrompt
  }

  const preferredTheme = theme || "dark"
  const preferredPrimary = primaryColor || "blue"
  const preferredSecondary = secondaryColor || "slate"

  return [
    trimmedPrompt,
    "",
    ENHANCED_PROMPT_REQUIREMENTS_HEADING,
    ENHANCED_PROMPT_BASE_REQUIREMENT,
    `- Use a ${preferredTheme} theme direction.`,
    `- Use ${preferredPrimary} as the primary color family and ${preferredSecondary} as the secondary color family.`,
    "- Expand it with clear sections, stronger hierarchy, and polished interaction states.",
  ].join("\n")
}