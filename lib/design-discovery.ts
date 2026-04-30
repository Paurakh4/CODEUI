export const MAX_DESIGN_DISCOVERY_QUESTIONS = 5
export const MAX_DESIGN_DISCOVERY_OPTIONS = 4

export type DesignDiscoveryFocusArea =
  | "platform"
  | "style"
  | "audience"
  | "color"
  | "density"

export interface DesignDiscoveryOption {
  id: string
  label: string
  description?: string
}

export interface DesignDiscoveryQuestion {
  id: string
  focusArea: DesignDiscoveryFocusArea
  question: string
  description?: string
  options: DesignDiscoveryOption[]
  customAnswerPlaceholder?: string
  allowSkip?: boolean
}

export interface DesignDiscoveryAnswer {
  questionId: string
  focusArea: DesignDiscoveryFocusArea
  question: string
  answer: string
  source: "option" | "custom" | "skip"
}

export interface DesignDiscoveryAssessment {
  prompt: string
  wordCount: number
  platformDefined: boolean
  styleDefined: boolean
  audienceDefined: boolean
  colorDefined: boolean
  densityDefined: boolean
  missingAreas: DesignDiscoveryFocusArea[]
  isComprehensive: boolean
  needsClarification: boolean
}

export interface DesignDiscoveryResult {
  needsClarification: boolean
  reasoning: string
  questions: DesignDiscoveryQuestion[]
}

const PLATFORM_PATTERNS = [
  /\bwebsite\b/i,
  /\bweb app\b/i,
  /\blanding page\b/i,
  /\bmarketing site\b/i,
  /\bmobile app\b/i,
  /\bdesktop app\b/i,
  /\bios app\b/i,
  /\bandroid app\b/i,
  /\bdashboard\b/i,
  /\btablet\b/i,
]

const STYLE_PATTERNS = [
  /\bminimal(?:ist)?\b/i,
  /\bmodern\b/i,
  /\bpremium\b/i,
  /\bluxury\b/i,
  /\beditorial\b/i,
  /\bbold\b/i,
  /\bplayful\b/i,
  /\bclean\b/i,
  /\bfriendly\b/i,
  /\bdark theme\b/i,
  /\blight theme\b/i,
  /\bmaterial\b/i,
  /\bglassmorphism\b/i,
  /\bbrutalist\b/i,
  /\bmood\b/i,
  /\baesthetic\b/i,
  /\bvisual style\b/i,
]

const AUDIENCE_PATTERNS = [
  /\btarget audience\b/i,
  /\bfor (?:(?:[a-z0-9-]+\s+){0,2})?(?:students|parents|kids|children|developers|designers|admins|administrators|professionals|teams|enterprises|startups|creators|consumers|customers|shoppers|job seekers|recruiters|freelancers|travellers|travelers|patients|clinicians)\b/i,
  /\bB2B\b/i,
  /\bB2C\b/i,
  /\benterprise\b/i,
  /\bconsumer\b/i,
  /\badmin users\b/i,
]

const COLOR_PATTERNS = [
  /\bpalette\b/i,
  /\bcolor direction\b/i,
  /\bmonochrome\b/i,
  /\bvibrant\b/i,
  /\bmuted\b/i,
  /\bneutral\b/i,
  /\bhigh contrast\b/i,
  /\bblue\b/i,
  /\bgreen\b/i,
  /\bred\b/i,
  /\byellow\b/i,
  /\bpurple\b/i,
  /\bteal\b/i,
  /\borange\b/i,
  /\bpink\b/i,
  /\bslate\b/i,
  /\bcharcoal\b/i,
]

const DENSITY_PATTERNS = [
  /\bcompact\b/i,
  /\bspacious\b/i,
  /\bdense\b/i,
  /\bairy\b/i,
  /\bbreathing room\b/i,
  /\blayout density\b/i,
  /\bcontent density\b/i,
]

const ALLOWED_FOCUS_AREAS: DesignDiscoveryFocusArea[] = [
  "platform",
  "style",
  "audience",
  "color",
  "density",
]

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function toId(prefix: string, value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${prefix}-${slug || index + 1}`
}

function normalizeSentence(value: string): string {
  return normalizeWhitespace(value).replace(/^[-\d.\s]+/, "")
}

function hasPatternMatch(prompt: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(prompt))
}

function normalizeOption(option: unknown, index: number): DesignDiscoveryOption | null {
  if (typeof option === "string") {
    const label = normalizeSentence(option)
    if (!label) {
      return null
    }

    return {
      id: toId("option", label, index),
      label,
    }
  }

  if (!option || typeof option !== "object") {
    return null
  }

  const record = option as Record<string, unknown>
  const label = normalizeSentence(String(record.label || record.title || ""))
  if (!label) {
    return null
  }

  const description = normalizeSentence(String(record.description || ""))

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : toId("option", label, index),
    label,
    description: description || undefined,
  }
}

function normalizeQuestion(question: unknown, index: number): DesignDiscoveryQuestion | null {
  if (!question || typeof question !== "object") {
    return null
  }

  const record = question as Record<string, unknown>
  const prompt = normalizeSentence(String(record.question || record.prompt || record.title || ""))
  if (!prompt) {
    return null
  }

  const rawFocusArea = typeof record.focusArea === "string" ? record.focusArea.trim().toLowerCase() : ""
  const focusArea = ALLOWED_FOCUS_AREAS.includes(rawFocusArea as DesignDiscoveryFocusArea)
    ? (rawFocusArea as DesignDiscoveryFocusArea)
    : "style"

  const options = Array.isArray(record.options)
    ? record.options
        .map((option, optionIndex) => normalizeOption(option, optionIndex))
        .filter((option): option is DesignDiscoveryOption => option !== null)
    : []

  const uniqueOptions = options.filter((option, optionIndex, allOptions) => {
    return allOptions.findIndex((candidate) => candidate.label.toLowerCase() === option.label.toLowerCase()) === optionIndex
  })

  if (uniqueOptions.length === 0) {
    return null
  }

  const description = normalizeSentence(String(record.description || ""))
  const customAnswerPlaceholder = normalizeSentence(String(record.customAnswerPlaceholder || record.placeholder || ""))

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : toId("question", prompt, index),
    focusArea,
    question: prompt,
    description: description || undefined,
    options: uniqueOptions.slice(0, MAX_DESIGN_DISCOVERY_OPTIONS),
    customAnswerPlaceholder: customAnswerPlaceholder || "Type your own answer",
    allowSkip: record.allowSkip !== false,
  }
}

function createQuestion(
  focusArea: DesignDiscoveryFocusArea,
  question: string,
  description: string,
  options: Array<{ label: string; description?: string }>,
  index: number,
): DesignDiscoveryQuestion {
  const normalizedQuestion = normalizeSentence(question)
  return {
    id: toId("question", normalizedQuestion, index),
    focusArea,
    question: normalizedQuestion,
    description: normalizeSentence(description) || undefined,
    options: options.slice(0, MAX_DESIGN_DISCOVERY_OPTIONS).map((option, optionIndex) => ({
      id: toId("option", option.label, optionIndex),
      label: normalizeSentence(option.label),
      description: normalizeSentence(option.description || "") || undefined,
    })),
    customAnswerPlaceholder: "Type your own answer",
    allowSkip: true,
  }
}

export function analyzeDesignDiscoveryNeeds(prompt: string): DesignDiscoveryAssessment {
  const normalizedPrompt = normalizeWhitespace(prompt)
  const wordCount = normalizedPrompt ? normalizedPrompt.split(/\s+/).length : 0
  const platformDefined = hasPatternMatch(normalizedPrompt, PLATFORM_PATTERNS)
  const styleDefined = hasPatternMatch(normalizedPrompt, STYLE_PATTERNS)
  const audienceDefined = hasPatternMatch(normalizedPrompt, AUDIENCE_PATTERNS)
  const colorDefined = hasPatternMatch(normalizedPrompt, COLOR_PATTERNS)
  const densityDefined = hasPatternMatch(normalizedPrompt, DENSITY_PATTERNS)

  const missingAreas: DesignDiscoveryFocusArea[] = []
  if (!platformDefined) missingAreas.push("platform")
  if (!styleDefined) missingAreas.push("style")
  if (!audienceDefined) missingAreas.push("audience")

  const isVeryShort = wordCount < 12
  if (!colorDefined && isVeryShort) {
    missingAreas.push("color")
  }
  if (!densityDefined && isVeryShort) {
    missingAreas.push("density")
  }

  const isComprehensive = platformDefined && styleDefined && audienceDefined

  return {
    prompt: normalizedPrompt,
    wordCount,
    platformDefined,
    styleDefined,
    audienceDefined,
    colorDefined,
    densityDefined,
    missingAreas,
    isComprehensive,
    needsClarification: !isComprehensive,
  }
}

export function buildDeterministicDesignDiscoveryResult(prompt: string): DesignDiscoveryResult {
  const assessment = analyzeDesignDiscoveryNeeds(prompt)

  if (!assessment.needsClarification) {
    return {
      needsClarification: false,
      reasoning: "The prompt already defines the platform, style direction, and audience clearly enough to generate immediately.",
      questions: [],
    }
  }

  const questions: DesignDiscoveryQuestion[] = []

  for (const focusArea of assessment.missingAreas) {
    if (questions.length >= MAX_DESIGN_DISCOVERY_QUESTIONS) {
      break
    }

    switch (focusArea) {
      case "platform":
        questions.push(
          createQuestion(
            "platform",
            "What platform context should this UI prioritize?",
            "Choose the screen environment the design should be optimized for first.",
            [
              { label: "Marketing website", description: "A public-facing landing or brand experience." },
              { label: "Web app", description: "A logged-in product or workflow interface." },
              { label: "Mobile app", description: "A touch-first app experience." },
              { label: "Desktop app", description: "A richer, desktop-focused workspace." },
            ],
            questions.length,
          ),
        )
        break
      case "style":
        questions.push(
          createQuestion(
            "style",
            "What visual mood should guide the design?",
            "Set the overall creative direction so the UI feels intentional instead of generic.",
            [
              { label: "Clean and minimal", description: "Quiet surfaces, crisp spacing, restrained styling." },
              { label: "Bold and expressive", description: "Stronger contrast, larger type, more energy." },
              { label: "Premium and polished", description: "Refined hierarchy, premium surfaces, editorial rhythm." },
              { label: "Playful and approachable", description: "Warmer tone, friendlier shapes, lighter feel." },
            ],
            questions.length,
          ),
        )
        break
      case "audience":
        questions.push(
          createQuestion(
            "audience",
            "Who should this interface feel designed for?",
            "The answer should influence hierarchy, tone, and complexity.",
            [
              { label: "General consumers", description: "Simple, friendly, low-friction UX." },
              { label: "Professionals or teams", description: "Clear structure and more information density." },
              { label: "Creative audience", description: "Stronger visual personality and presentation." },
              { label: "Technical or admin users", description: "Operational clarity and efficient workflows." },
            ],
            questions.length,
          ),
        )
        break
      case "color":
        questions.push(
          createQuestion(
            "color",
            "What color direction fits best?",
            "Only answer this if you want the palette to push the visual tone in a specific direction.",
            [
              { label: "Neutral and restrained", description: "Muted tones with a controlled accent." },
              { label: "Bold and high-contrast", description: "Crisp contrast and punchier accent colors." },
              { label: "Warm and inviting", description: "Softer warmth and approachable energy." },
              { label: "Cool and modern", description: "Cleaner, sharper, more contemporary palette." },
            ],
            questions.length,
          ),
        )
        break
      case "density":
        questions.push(
          createQuestion(
            "density",
            "What layout density should the UI use?",
            "This affects spacing, scanning speed, and the overall feel of the interface.",
            [
              { label: "Spacious", description: "More breathing room and stronger section separation." },
              { label: "Balanced", description: "Comfortable spacing without feeling sparse." },
              { label: "Compact", description: "Higher information density with tighter layouts." },
            ],
            questions.length,
          ),
        )
        break
    }
  }

  return {
    needsClarification: true,
    reasoning: "A few high-impact design details are still missing, so a short discovery pass will improve the UI brief before generation.",
    questions,
  }
}

export function normalizeDesignDiscoveryResult(raw: unknown, prompt: string): DesignDiscoveryResult {
  const fallback = buildDeterministicDesignDiscoveryResult(prompt)
  if (!raw || typeof raw !== "object") {
    return fallback
  }

  const record = raw as Record<string, unknown>
  const needsClarification =
    typeof record.needsClarification === "boolean"
      ? record.needsClarification
      : fallback.needsClarification

  if (!needsClarification) {
    return {
      needsClarification: false,
      reasoning:
        normalizeSentence(String(record.reasoning || "")) ||
        "The prompt already defines the platform, style direction, and audience clearly enough to generate immediately.",
      questions: [],
    }
  }

  const normalizedQuestions = Array.isArray(record.questions)
    ? record.questions
        .map((question, index) => normalizeQuestion(question, index))
        .filter((question): question is DesignDiscoveryQuestion => question !== null)
        .slice(0, MAX_DESIGN_DISCOVERY_QUESTIONS)
    : []

  if (normalizedQuestions.length === 0) {
    return fallback
  }

  return {
    needsClarification: true,
    reasoning:
      normalizeSentence(String(record.reasoning || "")) ||
      fallback.reasoning,
    questions: normalizedQuestions,
  }
}

export function composePromptWithDiscoveryAnswers(
  prompt: string,
  answers: DesignDiscoveryAnswer[],
): string {
  const normalizedPrompt = normalizeWhitespace(prompt)
  if (!normalizedPrompt) {
    return ""
  }

  const meaningfulAnswers = answers.filter((answer) => {
    if (answer.source === "skip") {
      return false
    }

    return normalizeSentence(answer.answer).length > 0
  })

  if (meaningfulAnswers.length === 0) {
    return normalizedPrompt
  }

  const uniqueAnswers = meaningfulAnswers.filter((answer, index, allAnswers) => {
    return allAnswers.findIndex((candidate) => candidate.questionId === answer.questionId) === index
  })

  return [
    normalizedPrompt,
    "",
    "Design discovery context:",
    ...uniqueAnswers.map((answer) => `- ${normalizeSentence(answer.question)}: ${normalizeSentence(answer.answer)}`),
  ].join("\n")
}