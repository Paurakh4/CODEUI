import { describe, expect, it } from "vitest"
import {
  buildCustomModelId,
  parseCustomModelId,
  resolveModelSourceProvider,
  CUSTOM_SOURCE_PROVIDER,
} from "@/lib/ai-models"
import { resolveModelCatalog, type ModelCatalogEntryInput } from "@/lib/admin/model-policy-utils"

describe("custom provider model id namespacing", () => {
  it("builds and parses namespaced custom model ids", () => {
    const id = buildCustomModelId("opencode-zen", "gpt-5.5")
    expect(id).toBe("custom:opencode-zen:gpt-5.5")
    expect(parseCustomModelId(id)).toEqual({
      providerId: "opencode-zen",
      upstreamModelId: "gpt-5.5",
    })
  })

  it("returns null for non-custom ids", () => {
    expect(parseCustomModelId("gpt-5.5")).toBeNull()
    expect(parseCustomModelId("openai/gpt-5")).toBeNull()
  })

  it("preserves upstream model ids containing slashes", () => {
    const id = buildCustomModelId("kilo-gateway", "anthropic/claude-sonnet-4.5")
    expect(parseCustomModelId(id)).toEqual({
      providerId: "kilo-gateway",
      upstreamModelId: "anthropic/claude-sonnet-4.5",
    })
  })
})

describe("resolveModelSourceProvider for custom", () => {
  it("resolves custom sourceProvider", () => {
    expect(
      resolveModelSourceProvider({ provider: "OpenCode Zen", sourceProvider: "custom" }),
    ).toBe(CUSTOM_SOURCE_PROVIDER)
  })
})

describe("resolveModelCatalog with custom provider fields", () => {
  it("carries customProviderId and upstreamModelId through the catalog", () => {
    const input: ModelCatalogEntryInput[] = [
      {
        id: "custom:opencode-zen:big-pickle",
        name: "Big Pickle",
        provider: "OpenCode Zen",
        sourceProvider: "custom",
        customProviderId: "opencode-zen",
        upstreamModelId: "big-pickle",
        contextLength: 128000,
      },
    ]

    const catalog = resolveModelCatalog(input, [])
    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({
      id: "custom:opencode-zen:big-pickle",
      customProviderId: "opencode-zen",
      upstreamModelId: "big-pickle",
      sourceProvider: "custom",
    })
  })
})
