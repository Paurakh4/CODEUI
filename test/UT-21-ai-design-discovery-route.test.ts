import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()
const getRuntimeDefaultModelId = vi.fn(async () => "test-model")
const getRuntimeModelFallbackChain = vi.fn(async (model: string) => [model])
const getRuntimeModelsById = vi.fn(async () => new Map([["test-model", { provider: "OpenRouter", sourceProvider: "openrouter" }]]))
const isRuntimeModelEnabled = vi.fn(async () => true)

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth", () => ({ auth }))

vi.mock("@/lib/admin/model-policies", () => ({
  getRuntimeDefaultModelId,
  getRuntimeModelFallbackChain,
  getRuntimeModelsById,
  isRuntimeModelEnabled,
}))

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/ai/design-discovery", {
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

describe("UT-21 AI design discovery route", () => {
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

  it("skips discovery for comprehensive prompts", async () => {
    global.fetch = vi.fn() as typeof global.fetch

    const { POST } = await import("@/app/api/ai/design-discovery/route")
    const response = await POST(
      createRequest({
        prompt: "Design a premium web app dashboard for finance teams with a clean editorial style and strong mobile behavior.",
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      needsClarification: false,
      reasoning: "The prompt already defines the platform, style direction, and audience clearly enough to generate immediately.",
      questions: [],
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("normalizes AI discovery questions for incomplete prompts", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          needsClarification: true,
          reasoning: "A few high-impact details are missing.",
          questions: [
            {
              focusArea: "platform",
              question: "What platform context should this UI prioritize?",
              options: ["Web app", "Mobile app"],
            },
            {
              focusArea: "audience",
              question: "Who should this interface feel designed for?",
              options: ["General consumers", "Professionals or teams"],
            },
          ],
        }),
      ),
    ) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/design-discovery/route")
    const response = await POST(createRequest({ prompt: "Make me a modern app" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      needsClarification: true,
      reasoning: "A few high-impact details are missing.",
      questions: expect.arrayContaining([
        expect.objectContaining({ focusArea: "platform" }),
        expect.objectContaining({ focusArea: "audience" }),
      ]),
    })
  })

  it("falls back deterministically when AI output is invalid", async () => {
    global.fetch = vi.fn().mockResolvedValue(createOpenRouterResponse("not valid json")) as typeof global.fetch

    const { POST } = await import("@/app/api/ai/design-discovery/route")
    const response = await POST(createRequest({ prompt: "Landing page" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      needsClarification: true,
      questions: expect.arrayContaining([
        expect.objectContaining({ focusArea: expect.any(String) }),
      ]),
    })
  })
})
