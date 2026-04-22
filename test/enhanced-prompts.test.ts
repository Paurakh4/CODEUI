import { describe, expect, it } from "vitest"

import {
  buildEnhancedPrompt,
  isEnhancedPrompt,
} from "@/lib/enhanced-prompts"

describe("buildEnhancedPrompt", () => {
  it("returns the original prompt when enhancement is disabled", () => {
    expect(
      buildEnhancedPrompt({
        prompt: "Create a portfolio landing page",
        enhancedPrompts: false,
      }),
    ).toBe("Create a portfolio landing page")
  })

  it("builds an enhanced prompt with user preferences", () => {
    const result = buildEnhancedPrompt({
      prompt: "Create a portfolio landing page",
      enhancedPrompts: true,
      primaryColor: "cyan",
      secondaryColor: "slate",
      theme: "light",
    })

    expect(result).toContain("Create a portfolio landing page")
    expect(result).toContain("Requirements:")
    expect(result).toContain("- Make it production-ready and responsive.")
    expect(result).toContain("- Use a light theme direction.")
    expect(result).toContain("- Use cyan as the primary color family and slate as the secondary color family.")
    expect(result).toContain("- Expand it with clear sections, stronger hierarchy, and polished interaction states.")
    expect(isEnhancedPrompt(result)).toBe(true)
  })

  it("does not double-enhance an already enhanced prompt", () => {
    const once = buildEnhancedPrompt({
      prompt: "Create a portfolio landing page",
      enhancedPrompts: true,
      primaryColor: "blue",
      secondaryColor: "slate",
      theme: "dark",
    })

    expect(
      buildEnhancedPrompt({
        prompt: once,
        enhancedPrompts: true,
        primaryColor: "blue",
        secondaryColor: "slate",
        theme: "dark",
      }),
    ).toBe(once)
  })
})