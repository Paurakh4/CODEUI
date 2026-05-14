import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()
const getRuntimeDefaultModelId = vi.fn(async () => "test-model")
const getRuntimeModelFallbackChain = vi.fn(async (model: string) => [model])
const isRuntimeModelEnabled = vi.fn(async () => true)

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth", () => ({ auth }))

vi.mock("@/lib/admin/model-policies", () => ({
  getRuntimeDefaultModelId,
  getRuntimeModelFallbackChain,
  isRuntimeModelEnabled,
}))

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/ai/generation-summary", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-codeui-request-id": "ut-21-request",
    },
    body: JSON.stringify(body),
  })
}

function createOpenRouterResponse(content: string, status = 200): Response {
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

describe("UT-21 AI generation summary route", () => {
  const originalFetch = global.fetch
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "ut-21-openrouter-key"
    auth.mockResolvedValue({ user: { id: "user-1", email: "user@example.com" } })
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey
    }
  })

  it("returns an AI-written assistant message after generation", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        "I built a celebratory one-page website for To Someone Extraordinary with a bold gradient backdrop, editorial typography, layered cards, and soft motion that keeps the reveal feeling warm and polished.",
      ),
    ) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/generation-summary/route")
    const response = await POST(
      createRequest({
        prompt: "Build a custom website centered on To Someone Extraordinary",
        html: "<!DOCTYPE html><html><body><main><h1>To Someone Extraordinary</h1><section class='gradient card'>Celebrate</section></main></body></html>",
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      assistantMessage: expect.stringContaining("I built"),
      meta: {
        modelUsed: "test-model",
        fallbackUsed: false,
      },
    })
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it("requires html context", async () => {
    global.fetch = vi.fn() as typeof global.fetch

    const { POST } = await import("@/app/api/ai/generation-summary/route")
    const response = await POST(
      createRequest({
        prompt: "Build a custom website centered on To Someone Extraordinary",
        html: "",
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "HTML is required",
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})