import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OPENROUTER_SOURCE_PROVIDER, PXROUTE_SOURCE_PROVIDER } from "@/lib/ai-models"
import { requestAITextCompletion } from "@/lib/ai-provider-client"

function createCompletionResponse(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  )
}

describe("UT-31 AI provider client", () => {
  const originalFetch = global.fetch
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY
  const originalPxRouteKey = process.env.PXROUTE_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "ut-openrouter-key"
    process.env.PXROUTE_API_KEY = "ut-pxroute-key"
  })

  afterEach(() => {
    global.fetch = originalFetch

    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey
    }

    if (originalPxRouteKey === undefined) {
      delete process.env.PXROUTE_API_KEY
    } else {
      process.env.PXROUTE_API_KEY = originalPxRouteKey
    }
  })

  it("routes PxRoute models to MidRelay with the PxRoute key", async () => {
    global.fetch = vi.fn().mockResolvedValue(createCompletionResponse("pxroute response")) as typeof global.fetch

    const result = await requestAITextCompletion({
      requestId: "ut-31-pxroute",
      requestedModel: "claude-sonnet-4-6",
      fallbackChain: ["claude-sonnet-4-6"],
      modelsById: new Map([
        ["claude-sonnet-4-6", { provider: "PxRoute", sourceProvider: PXROUTE_SOURCE_PROVIDER }],
      ]),
      messages: [{ role: "user", content: "hello" }],
    })

    expect(result).toEqual({
      content: "pxroute response",
      modelUsed: "claude-sonnet-4-6",
      fallbackUsed: false,
    })
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.midrelay.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ut-pxroute-key",
        }),
      }),
    )
  })

  it("routes OpenRouter models to OpenRouter with the OpenRouter key", async () => {
    global.fetch = vi.fn().mockResolvedValue(createCompletionResponse("openrouter response")) as typeof global.fetch

    const result = await requestAITextCompletion({
      requestId: "ut-31-openrouter",
      requestedModel: "deepseek/deepseek-chat",
      fallbackChain: ["deepseek/deepseek-chat"],
      modelsById: new Map([
        ["deepseek/deepseek-chat", { provider: "DeepSeek", sourceProvider: OPENROUTER_SOURCE_PROVIDER }],
      ]),
      messages: [{ role: "user", content: "hello" }],
    })

    expect(result.content).toBe("openrouter response")
    expect(global.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ut-openrouter-key",
          "HTTP-Referer": "http://localhost:3000",
        }),
      }),
    )
  })
})
