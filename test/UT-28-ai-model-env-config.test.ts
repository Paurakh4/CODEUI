import { afterEach, describe, expect, it } from "vitest"

import {
  CODEUI_GOD_MODE_MODEL_ID,
  PXROUTE_SOURCE_PROVIDER,
  getEnabledModels,
  getDefaultModelId,
  getModelFallbackChain,
  resolveModelSourceProvider,
} from "@/lib/ai-models"

const originalEnabledModels = process.env.ENABLED_AI_MODELS
const originalDefaultModel = process.env.DEFAULT_AI_MODEL
const originalFallbackModels = process.env.FALLBACK_AI_MODELS

afterEach(() => {
  if (originalEnabledModels === undefined) {
    delete process.env.ENABLED_AI_MODELS
  } else {
    process.env.ENABLED_AI_MODELS = originalEnabledModels
  }

  if (originalDefaultModel === undefined) {
    delete process.env.DEFAULT_AI_MODEL
  } else {
    process.env.DEFAULT_AI_MODEL = originalDefaultModel
  }

  if (originalFallbackModels === undefined) {
    delete process.env.FALLBACK_AI_MODELS
  } else {
    process.env.FALLBACK_AI_MODELS = originalFallbackModels
  }
})

describe("UT-28 ai model env configuration", () => {
  it("prefers DEFAULT_AI_MODEL when it is enabled", () => {
    process.env.ENABLED_AI_MODELS = [
      CODEUI_GOD_MODE_MODEL_ID,
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1",
    ].join(",")
    process.env.DEFAULT_AI_MODEL = "deepseek/deepseek-r1"

    expect(getDefaultModelId()).toBe("deepseek/deepseek-r1")
  })

  it("honors FALLBACK_AI_MODELS order after the requested and default models", () => {
    process.env.ENABLED_AI_MODELS = [
      CODEUI_GOD_MODE_MODEL_ID,
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1",
      "anthropic/claude-haiku-4.5",
    ].join(",")
    process.env.DEFAULT_AI_MODEL = "deepseek/deepseek-chat"
    process.env.FALLBACK_AI_MODELS = [
      "anthropic/claude-haiku-4.5",
      "deepseek/deepseek-r1",
    ].join(",")

    expect(getModelFallbackChain(CODEUI_GOD_MODE_MODEL_ID)).toEqual([
      CODEUI_GOD_MODE_MODEL_ID,
      "deepseek/deepseek-chat",
      "anthropic/claude-haiku-4.5",
      "deepseek/deepseek-r1",
    ])
  })

  it("includes PxRoute models with PxRoute provider metadata", () => {
    const pxRouteModel = getEnabledModels().find((model) => model.id === "claude-sonnet-4-6")

    expect(pxRouteModel).toEqual(
      expect.objectContaining({
        id: "claude-sonnet-4-6",
        provider: "PxRoute",
        sourceProvider: PXROUTE_SOURCE_PROVIDER,
        isFast: true,
      }),
    )
    expect(resolveModelSourceProvider(pxRouteModel)).toBe(PXROUTE_SOURCE_PROVIDER)
  })
})
