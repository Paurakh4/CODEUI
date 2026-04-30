export type PromptEnhancementStrength = "light" | "standard" | "strong"

export interface PromptEnhancementContext {
  prompt: string
  strength?: PromptEnhancementStrength
}

export interface PromptEnhancementResult {
  enhancedPrompt: string
  warning?: string
  skipped?: boolean
}

const UI_PROMPT_PATTERNS = [
  /\bui\b/i,
  /\bux\b/i,
  /\binterface\b/i,
  /\blanding page\b/i,
  /\bwebsite\b/i,
  /\bweb app\b/i,
  /\bdashboard\b/i,
  /\bpage\b/i,
  /\bscreen\b/i,
  /\bapp\b/i,
  /\bdesign\b/i,
  /\bcomponent\b/i,
  /\bhero\b/i,
  /\bcheckout\b/i,
  /\bportfolio\b/i,
  /\bpricing\b/i,
  /\bform\b/i,
  /\bnavigation\b/i,
]

const NON_UI_PATTERNS = [
  /\bpoem\b/i,
  /\bessay\b/i,
  /\bstory\b/i,
  /\bnovel\b/i,
  /\brecipe\b/i,
  /\bmath problem\b/i,
  /\bcalculate\b/i,
  /\btranslate\b/i,
  /\bsummarize article\b/i,
]

const UI_EDIT_ACTION_PATTERNS = [
  /\badd\b/i,
  /\bupdate\b/i,
  /\bchange\b/i,
  /\bimprove\b/i,
  /\bmake\b/i,
  /\brefine\b/i,
  /\badjust\b/i,
  /\bredesign\b/i,
  /\brestyle\b/i,
  /\btighten\b/i,
  /\bsimplify\b/i,
  /\bremove\b/i,
  /\bmove\b/i,
  /\breorder\b/i,
  /\btweak\b/i,
  /\bincrease\b/i,
  /\bdecrease\b/i,
  /\bpolish\b/i,
]

const UI_EDIT_TARGET_PATTERNS = [
  /\bsection\b/i,
  /\blayout\b/i,
  /\bspacing\b/i,
  /\btypography\b/i,
  /\bcolor\b/i,
  /\bpalette\b/i,
  /\btheme\b/i,
  /\bbutton\b/i,
  /\bcta\b/i,
  /\bnavbar\b/i,
  /\bnavigation\b/i,
  /\bheader\b/i,
  /\bfooter\b/i,
  /\bhero\b/i,
  /\bcard\b/i,
  /\bmodal\b/i,
  /\bform\b/i,
  /\binput\b/i,
  /\btable\b/i,
  /\bchart\b/i,
  /\bgrid\b/i,
  /\bgallery\b/i,
  /\btestimonial\b/i,
  /\bpricing\b/i,
  /\bfaq\b/i,
  /\bfeature\b/i,
  /\bsidebar\b/i,
  /\bpanel\b/i,
  /\bcanvas\b/i,
  /\bpreview\b/i,
  /\banimation\b/i,
  /\binteraction\b/i,
]

const PLATFORM_SIGNALS = [
  "website",
  "web app",
  "landing page",
  "mobile app",
  "desktop app",
  "ios app",
  "android app",
  "dashboard",
] as const

export const PROMPT_ENHANCEMENT_SYSTEM_PROMPT = [
  "You are a Senior UI/UX Designer with over 10 years of experience refining rough product ideas into high-quality UI briefs.",
  "Rewrite the user's prompt so it is clearer, more structured, and more professional without changing the core intent.",
  "Improve clarity, not meaning.",
  "Do not introduce new product features.",
  "Do not change platform assumptions or audience assumptions.",
  "Add relevant UI/UX guidance only when it is already implied by the original request.",
  "The result should read like a strong design-generation brief with clear layout, hierarchy, interaction, and design-system direction.",
  "Return plain text only. No code fences. No explanations.",
].join(" ")

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function normalizeSentence(value: string): string {
  return normalizeWhitespace(value).replace(/^Enhanced Prompt:\s*/i, "")
}

function detectPlatformSignals(prompt: string): string[] {
  const normalizedPrompt = prompt.toLowerCase()
  return PLATFORM_SIGNALS.filter((signal) => normalizedPrompt.includes(signal))
}

export function isLikelyUiPrompt(prompt: string): boolean {
  const normalizedPrompt = normalizeWhitespace(prompt)
  if (!normalizedPrompt) {
    return false
  }

  if (NON_UI_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) {
    return false
  }

  const looksLikeUiEditRequest =
    UI_EDIT_ACTION_PATTERNS.some((pattern) => pattern.test(normalizedPrompt)) &&
    UI_EDIT_TARGET_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))

  if (looksLikeUiEditRequest) {
    return true
  }

  return UI_PROMPT_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))
}

export function isVeryLongPrompt(prompt: string): boolean {
  return normalizeWhitespace(prompt).length >= 1200
}

export function buildPromptEnhancementUserPrompt({
  prompt,
  strength = "standard",
}: PromptEnhancementContext): string {
  const normalizedPrompt = normalizeWhitespace(prompt)
  const strengthRule =
    strength === "light"
      ? "Use a light touch: clean up wording, fix ambiguity, and improve structure without significantly expanding the prompt."
      : strength === "strong"
        ? "Use a strong rewrite: fully restructure the prompt into a polished design brief while staying faithful to the original meaning."
        : "Use a professional rewrite: improve structure, clarity, and instruction quality while preserving the original meaning."

  return [
    "Rewrite the following UI prompt.",
    strengthRule,
    "Preserve the user's intended product, scope, platform, and audience.",
    "Include clearer layout direction, visual hierarchy, interaction guidance, and design-system language only when implied by the original request.",
    isVeryLongPrompt(normalizedPrompt)
      ? "The prompt is long. Summarize and structure it clearly without dropping important meaning or introducing new features."
      : "",
    "",
    "Original prompt:",
    normalizedPrompt,
  ].filter(Boolean).join("\n")
}

export function sanitizeEnhancedPromptOutput(output: string): string {
  return normalizeSentence(
    output
      .replace(/^```[a-zA-Z0-9_-]*\s*/u, "")
      .replace(/```$/u, ""),
  )
}

export function buildDeterministicPromptEnhancement({
  prompt,
  strength = "standard",
}: PromptEnhancementContext): string {
  const normalizedPrompt = normalizeWhitespace(prompt)
  const leadIn =
    strength === "light"
      ? "Clarify the request and tighten the wording while preserving the existing scope."
      : strength === "strong"
        ? "Restructure the request into a polished design brief while staying faithful to the original intent."
        : "Rewrite the request into a clearer, more professional UI brief without changing its meaning."

  return [
    normalizedPrompt,
    "",
    "Design brief guidance:",
    `- ${leadIn}`,
    "- Keep the same core intent, product scope, platform assumptions, and audience assumptions.",
    "- Make the layout direction, visual hierarchy, and component emphasis easier to understand.",
    "- Describe relevant interaction states, spacing, typography, and responsive behavior only where the original request already points in that direction.",
    "- Do not invent new features or expand the product scope.",
  ].join("\n")
}

export function detectPromptEnhancementWarning(prompt: string): string | undefined {
  const normalizedPrompt = normalizeWhitespace(prompt)
  if (!normalizedPrompt) {
    return "Add a UI request before using Prompt Enhance."
  }

  if (!isLikelyUiPrompt(normalizedPrompt)) {
    return "Prompt Enhance is designed for UI prompts, so this request was left unchanged."
  }

  if (isVeryLongPrompt(normalizedPrompt)) {
    return "This prompt is long, so the enhancer should summarize and structure it while preserving meaning."
  }

  return undefined
}

export function isPromptEnhancementSafe(originalPrompt: string, candidatePrompt: string): boolean {
  const normalizedOriginal = normalizeWhitespace(originalPrompt)
  const normalizedCandidate = sanitizeEnhancedPromptOutput(candidatePrompt)

  if (!normalizedCandidate) {
    return false
  }

  if (!isLikelyUiPrompt(normalizedCandidate)) {
    return false
  }

  const originalPlatforms = detectPlatformSignals(normalizedOriginal)
  const candidatePlatforms = detectPlatformSignals(normalizedCandidate)
  if (originalPlatforms.length > 0) {
    return originalPlatforms.every((platform) => candidatePlatforms.includes(platform))
  }

  return true
}

export function resolvePromptEnhancement(
  aiOutput: string,
  context: PromptEnhancementContext,
): PromptEnhancementResult {
  const normalizedPrompt = normalizeWhitespace(context.prompt)
  const warning = detectPromptEnhancementWarning(normalizedPrompt)

  if (!normalizedPrompt) {
    return {
      enhancedPrompt: "",
      warning,
      skipped: true,
    }
  }

  if (!isLikelyUiPrompt(normalizedPrompt)) {
    return {
      enhancedPrompt: normalizedPrompt,
      warning,
      skipped: true,
    }
  }

  const sanitizedOutput = sanitizeEnhancedPromptOutput(aiOutput)
  if (!isPromptEnhancementSafe(normalizedPrompt, sanitizedOutput)) {
    return {
      enhancedPrompt: buildDeterministicPromptEnhancement(context),
      warning,
    }
  }

  if (normalizeWhitespace(sanitizedOutput) === normalizedPrompt) {
    return {
      enhancedPrompt: buildDeterministicPromptEnhancement(context),
      warning,
    }
  }

  return {
    enhancedPrompt: sanitizedOutput,
    warning,
  }
}