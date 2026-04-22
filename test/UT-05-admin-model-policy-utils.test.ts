import { describe, expect, it } from "vitest"

import { CODEUI_GOD_MODE_MODEL_ID } from "@/lib/ai-models"
import {
  resolveDefaultModelId,
  sanitizeEnabledModelIds,
} from "@/lib/admin/model-policy-utils"

describe("UT-05 admin model policy utils", () => {
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
    expect(sanitizeEnabledModelIds([], ["deepseek/deepseek-r1"])).toEqual(["deepseek/deepseek-r1"])
  })

  it("keeps an enabled default model", () => {
    expect(
      resolveDefaultModelId("deepseek/deepseek-chat", ["deepseek/deepseek-chat"]),
    ).toBe("deepseek/deepseek-chat")
  })

  it("falls back to god mode when the requested default is unavailable", () => {
    expect(
      resolveDefaultModelId(undefined, [CODEUI_GOD_MODE_MODEL_ID, "deepseek/deepseek-chat"]),
    ).toBe(CODEUI_GOD_MODE_MODEL_ID)
  })
})