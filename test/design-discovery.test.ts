import { describe, expect, it } from "vitest"

import {
  MAX_DESIGN_DISCOVERY_OPTIONS,
  MAX_DESIGN_DISCOVERY_QUESTIONS,
  analyzeDesignDiscoveryNeeds,
  buildDeterministicDesignDiscoveryResult,
  composePromptWithDiscoveryAnswers,
  normalizeDesignDiscoveryResult,
} from "@/lib/design-discovery"

describe("design discovery", () => {
  it("skips discovery when platform, style, and audience are defined", () => {
    const result = analyzeDesignDiscoveryNeeds(
      "Design a premium web app dashboard for finance teams with a clean editorial style and strong mobile behavior.",
    )

    expect(result.platformDefined).toBe(true)
    expect(result.styleDefined).toBe(true)
    expect(result.audienceDefined).toBe(true)
    expect(result.isComprehensive).toBe(true)
    expect(result.needsClarification).toBe(false)
  })

  it("asks only for missing high-impact areas and stays within limits", () => {
    const result = buildDeterministicDesignDiscoveryResult("Make me a modern app")

    expect(result.needsClarification).toBe(true)
    expect(result.questions.length).toBeGreaterThan(0)
    expect(result.questions.length).toBeLessThanOrEqual(MAX_DESIGN_DISCOVERY_QUESTIONS)
    expect(result.questions.every((question) => question.options.length <= MAX_DESIGN_DISCOVERY_OPTIONS)).toBe(true)
    expect(result.questions.some((question) => question.focusArea === "platform")).toBe(true)
    expect(result.questions.some((question) => question.focusArea === "audience")).toBe(true)
  })

  it("normalizes AI questions and clamps extras", () => {
    const result = normalizeDesignDiscoveryResult(
      {
        needsClarification: true,
        reasoning: "The prompt is still broad.",
        questions: [
          {
            focusArea: "style",
            question: "What visual mood should guide the design?",
            options: ["Minimal", "Minimal", "Bold", "Premium", "Playful"],
          },
          {
            focusArea: "platform",
            question: "What platform context should this UI prioritize?",
            options: ["Web app", "Mobile app"],
          },
          {
            focusArea: "audience",
            question: "Who should this interface feel designed for?",
            options: ["Consumers", "Teams"],
          },
          {
            focusArea: "density",
            question: "What layout density should the UI use?",
            options: ["Spacious", "Balanced"],
          },
          {
            focusArea: "color",
            question: "What color direction fits best?",
            options: ["Neutral", "High contrast"],
          },
          {
            focusArea: "platform",
            question: "Should be trimmed",
            options: ["One", "Two"],
          },
        ],
      },
      "Create something modern",
    )

    expect(result.reasoning).toBe("The prompt is still broad.")
    expect(result.questions).toHaveLength(MAX_DESIGN_DISCOVERY_QUESTIONS)
    expect(result.questions[0].options).toHaveLength(MAX_DESIGN_DISCOVERY_OPTIONS)
    expect(result.questions[0].options.map((option) => option.label)).toEqual([
      "Minimal",
      "Bold",
      "Premium",
      "Playful",
    ])
  })

  it("falls back to deterministic questions when AI output is unusable", () => {
    const result = normalizeDesignDiscoveryResult({ needsClarification: true, questions: [] }, "Landing page")

    expect(result.needsClarification).toBe(true)
    expect(result.questions.length).toBeGreaterThan(0)
  })

  it("compiles final prompt text without skipped answers", () => {
    const result = composePromptWithDiscoveryAnswers("Create a portfolio website", [
      {
        questionId: "q-style",
        focusArea: "style",
        question: "What visual mood should guide the design?",
        answer: "Premium and polished",
        source: "option",
      },
      {
        questionId: "q-platform",
        focusArea: "platform",
        question: "What platform context should this UI prioritize?",
        answer: "",
        source: "skip",
      },
    ])

    expect(result).toContain("Create a portfolio website")
    expect(result).toContain("Design discovery context:")
    expect(result).toContain("Premium and polished")
    expect(result).not.toContain("What platform context should this UI prioritize?")
  })
})