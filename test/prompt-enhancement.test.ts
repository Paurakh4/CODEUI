import { describe, expect, it } from "vitest"

import {
  PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
  buildDeterministicPromptEnhancement,
  buildPromptEnhancementUserPrompt,
  detectPromptEnhancementWarning,
  isLikelyUiPrompt,
  isPromptEnhancementSafe,
  isVeryLongPrompt,
  resolvePromptEnhancement,
  sanitizeEnhancedPromptOutput,
} from "@/lib/prompt-enhancement"

describe("prompt enhancement", () => {
  it("builds a system prompt that preserves meaning", () => {
    expect(PROMPT_ENHANCEMENT_SYSTEM_PROMPT).toContain("Senior UI/UX Designer")
    expect(PROMPT_ENHANCEMENT_SYSTEM_PROMPT).toContain("Improve clarity, not meaning")
    expect(PROMPT_ENHANCEMENT_SYSTEM_PROMPT).toContain("Do not introduce new product features")
  })

  it("builds a strength-aware user prompt", () => {
    const result = buildPromptEnhancementUserPrompt({
      prompt: "Create a dashboard for recruiters",
      strength: "strong",
    })

    expect(result).toContain("strong rewrite")
    expect(result).toContain("Preserve the user's intended product, scope, platform, and audience")
  })

  it("detects non-ui prompts and warns instead of forcing enhancement", () => {
    expect(isLikelyUiPrompt("Write a poem about the ocean")).toBe(false)
    expect(detectPromptEnhancementWarning("Write a poem about the ocean")).toContain("designed for UI prompts")
  })

  it("treats targeted UI edit requests as enhanceable prompts", () => {
    expect(isLikelyUiPrompt("Add a testimonials section below the pricing cards and tighten the spacing")).toBe(true)
  })

  it("flags very long prompts for summarize-and-structure handling", () => {
    const longPrompt = `${"Build a web app dashboard for finance teams with dense tables and filters. ".repeat(30)}`

    expect(isVeryLongPrompt(longPrompt)).toBe(true)
    expect(buildPromptEnhancementUserPrompt({ prompt: longPrompt })).toContain("Summarize and structure")
  })

  it("sanitizes raw AI output", () => {
    const result = sanitizeEnhancedPromptOutput("```text\nEnhanced Prompt: Create a clean web app with strong hierarchy.\n```")

    expect(result).toBe("Create a clean web app with strong hierarchy.")
  })

  it("rejects platform-changing rewrites and falls back deterministically", () => {
    expect(
      isPromptEnhancementSafe(
        "Create a mobile app for students",
        "Create a desktop app for students with a stronger layout.",
      ),
    ).toBe(false)

    const result = resolvePromptEnhancement("Create a desktop app for students.", {
      prompt: "Create a mobile app for students",
      strength: "standard",
    })

    expect(result.enhancedPrompt).toContain("Design brief guidance:")
  })

  it("falls back deterministically when the enhancer returns the original prompt unchanged", () => {
    const result = resolvePromptEnhancement("Create a landing page for a recruiting platform", {
      prompt: "Create a landing page for a recruiting platform",
      strength: "standard",
    })

    expect(result.enhancedPrompt).toContain("Design brief guidance:")
    expect(result.enhancedPrompt).not.toBe("Create a landing page for a recruiting platform")
  })

  it("returns the original prompt for non-ui requests", () => {
    const result = resolvePromptEnhancement("Any output", {
      prompt: "Translate this paragraph into Spanish",
    })

    expect(result.skipped).toBe(true)
    expect(result.enhancedPrompt).toBe("Translate this paragraph into Spanish")
  })

  it("can build a deterministic enhancement without changing scope", () => {
    const result = buildDeterministicPromptEnhancement({
      prompt: "Create a landing page for a recruiting platform",
      strength: "light",
    })

    expect(result).toContain("Create a landing page for a recruiting platform")
    expect(result).toContain("Keep the same core intent")
  })
})