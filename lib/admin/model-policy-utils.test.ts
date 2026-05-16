import { describe, expect, it } from "vitest"

import { CODEUI_GOD_MODE_MODEL_ID } from "@/lib/ai-models"
import {
  resolveModelCatalog,
  resolveDefaultModelId,
  sanitizeEnabledModelIds,
} from "@/lib/admin/model-policy-utils"

describe("admin model policy utils", () => {
  it("keeps only known model ids and removes duplicates", () => {
    expect(
      sanitizeEnabledModelIds([
        "deepseek/deepseek-chat",
        "deepseek/deepseek-chat",
        "unknown/model",
      ]),
    ).toEqual(["deepseek/deepseek-chat"])
  })

  it("falls back when candidate ids are empty", () => {
    expect(sanitizeEnabledModelIds([], ["deepseek/deepseek-r1"]))
      .toEqual(["deepseek/deepseek-r1"])
  })

  it("accepts admin-managed model ids when provided as known ids", () => {
    expect(
      sanitizeEnabledModelIds(
        ["openai/gpt-5-mini", "unknown/model"],
        [],
        ["deepseek/deepseek-chat", "openai/gpt-5-mini"],
      ),
    ).toEqual(["openai/gpt-5-mini"])
  })

  it("merges admin-managed models into the base catalog", () => {
    const catalog = resolveModelCatalog([
      {
        id: "deepseek/deepseek-chat",
        name: "DeepSeek V3 Custom",
        provider: "DeepSeek",
        contextLength: 64000,
      },
      {
        id: "openai/gpt-5-mini",
        name: "GPT-5 Mini",
        provider: "OpenAI",
        description: "Admin-added model",
        contextLength: 400000,
        isFast: true,
      },
    ])

    expect(catalog.find((model) => model.id === "deepseek/deepseek-chat")).toEqual(
      expect.objectContaining({
        id: "deepseek/deepseek-chat",
        name: "DeepSeek V3 Custom",
      }),
    )
    expect(catalog.at(-1)).toEqual(
      expect.objectContaining({
        id: "openai/gpt-5-mini",
        name: "GPT-5 Mini",
        provider: "OpenAI",
        description: "Admin-added model",
        contextLength: 400000,
        isFast: true,
      }),
    )
  })

  it("overrides the visible name for an existing base model", () => {
    expect(
      resolveModelCatalog([
        {
          id: "deepseek/deepseek-chat",
          name: "DeepSeek V3 Visible",
          provider: "DeepSeek",
          contextLength: 64000,
        },
      ]).find((model) => model.id === "deepseek/deepseek-chat")?.name,
    ).toBe("DeepSeek V3 Visible")
  })

  it("keeps an enabled default model", () => {
    expect(
      resolveDefaultModelId("deepseek/deepseek-chat", ["deepseek/deepseek-chat"]),
    ).toBe("deepseek/deepseek-chat")
  })

  it("uses the env fallback default when the admin default is unavailable", () => {
    expect(
      resolveDefaultModelId(
        "unknown/model",
        ["deepseek/deepseek-chat", CODEUI_GOD_MODE_MODEL_ID],
        "deepseek/deepseek-chat",
      ),
    ).toBe("deepseek/deepseek-chat")
  })

  it("falls back to god mode when the requested default is unavailable", () => {
    expect(
      resolveDefaultModelId(undefined, [CODEUI_GOD_MODE_MODEL_ID, "deepseek/deepseek-chat"]),
    ).toBe(CODEUI_GOD_MODE_MODEL_ID)
  })
})