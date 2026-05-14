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
  return new Request("http://localhost:3000/api/ai/enhance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-codeui-request-id": "ut-20-request",
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

describe("UT-20 AI enhance route", () => {
  const originalFetch = global.fetch
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "ut-20-openrouter-key"
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

  it("returns an AI-enhanced prompt for UI requests", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        "Create a polished web app dashboard for finance teams with a clearer modular layout, stronger visual hierarchy, refined component emphasis, and more explicit interaction states while keeping the original scope intact.",
      ),
    ) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/enhance/route")
    const response = await POST(createRequest({ prompt: "Create a dashboard for finance teams" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      enhancedPrompt: expect.stringContaining("visual hierarchy"),
      meta: {
        modelUsed: "test-model",
        fallbackUsed: false,
      },
    })
  })

  it("treats short app prompts like calculators as UI requests", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        "Create a polished calculator app with clearer keypad hierarchy, stronger display emphasis, and refined interaction feedback while keeping the same simple scope.",
      ),
    ) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/enhance/route")
    const response = await POST(createRequest({ prompt: "Create a calculator" }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({
      enhancedPrompt: expect.stringContaining("calculator app"),
    })
    expect(data.skipped).not.toBe(true)
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it("enhances generic build prompts like birthday surprise cards", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        "Build a playful interactive birthday surprise card with a celebratory reveal, stronger message hierarchy, and memorable delight moments while preserving the same lightweight scope.",
      ),
    ) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/enhance/route")
    const response = await POST(createRequest({ prompt: "Build a cool birthday wish surprise card" }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({
      enhancedPrompt: expect.stringContaining("birthday surprise card"),
    })
    expect(data.skipped).not.toBe(true)
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it("skips non-ui requests and returns a warning", async () => {
    global.fetch = vi.fn() as typeof global.fetch

    const { POST } = await import("@/app/api/ai/enhance/route")
    const response = await POST(createRequest({ prompt: "Write a poem about the ocean" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      enhancedPrompt: "Write a poem about the ocean",
      skipped: true,
      warning: expect.stringContaining("designed for UI prompts"),
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("falls back deterministically when the AI output is unsafe", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createOpenRouterResponse("Create a desktop app for students with many extra features."),
    ) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/enhance/route")
    const response = await POST(createRequest({ prompt: "Create a mobile app for students" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      enhancedPrompt: expect.stringContaining("Design brief guidance:"),
    })
  })
})