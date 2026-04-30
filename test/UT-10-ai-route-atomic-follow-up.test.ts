import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()
const connectDB = vi.fn(async () => undefined)
const userFindById = vi.fn()
const userFindByIdAndUpdate = vi.fn()
const usageLogCreate = vi.fn(async () => undefined)
const getRuntimeDefaultModelId = vi.fn(async () => "test-model")
const getRuntimeModelFallbackChain = vi.fn(async (model: string) => [model])
const isRuntimeModelEnabled = vi.fn(async () => true)
const isInternalUserRole = vi.fn(() => true)
const resolveUserRole = vi.fn(() => "admin")

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth", () => ({
  auth,
}))

vi.mock("@/lib/db", () => ({
  default: connectDB,
}))

vi.mock("@/lib/models", () => ({
  User: {
    findById: userFindById,
    findByIdAndUpdate: userFindByIdAndUpdate,
  },
  UsageLog: {
    create: usageLogCreate,
  },
}))

vi.mock("@/lib/admin/model-policies", () => ({
  getRuntimeDefaultModelId,
  getRuntimeModelFallbackChain,
  isRuntimeModelEnabled,
}))

vi.mock("@/lib/admin/rbac", () => ({
  isInternalUserRole,
  resolveUserRole,
}))

function createOpenRouterStream(content: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`),
      )
      controller.enqueue(encoder.encode("data: [DONE]\n"))
      controller.close()
    },
  })

  return new Response(stream, { status: 200 })
}

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/ai", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-codeui-request-id": "ut-10-request",
    },
    body: JSON.stringify(body),
  })
}

function parseSse(text: string) {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => JSON.parse(block.replace(/^data: /, ""))) as Array<{ type: string; data: unknown }>
}

describe("UT-10 AI route atomic follow-up retry", () => {
  const originalFetch = global.fetch
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "ut-10-openrouter-key"
    auth.mockResolvedValue({ user: { id: "user-1", email: "user@example.com" } })
    userFindById.mockResolvedValue({
      _id: "user-1",
      email: "user@example.com",
      role: "admin",
      monthlyCredits: 10,
      topupCredits: 0,
      subscription: { tier: "free" },
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey
    }
  })

  it("hides an invalid first follow-up and emits only the retry's complete HTML", async () => {
    const validHtml = "<!DOCTYPE html><html><body><main>Light mode update</main></body></html>"
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createOpenRouterStream("<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE"))
      .mockResolvedValueOnce(createOpenRouterStream(validHtml))
    global.fetch = fetchMock

    const { POST } = await import("@/app/api/ai/route")
    const response = await POST(
      createRequest({
        prompt: "make it light mode",
        currentHtml: "<!DOCTYPE html><html><body><main>Dark mode</main></body></html>",
        isFollowUp: true,
        model: "test-model",
      }) as never,
    )

    expect(response.status).toBe(200)
    const events = parseSse(await response.text())
    const contentEvents = events.filter((event) => event.type === "content")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(contentEvents).toEqual([{ type: "content", data: validHtml }])
    expect(events.some((event) => event.type === "error")).toBe(false)
  })

  it("returns one clean error without emitting invalid content when the hidden retry also fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createOpenRouterStream("<<<<<<< SEARCH\nold\n=======\nnew"))
      .mockResolvedValueOnce(createOpenRouterStream("Here is the updated page."))
    global.fetch = fetchMock

    const { POST } = await import("@/app/api/ai/route")
    const response = await POST(
      createRequest({
        prompt: "change the heading",
        currentHtml: "<!DOCTYPE html><html><body><main>Original</main></body></html>",
        isFollowUp: true,
        model: "test-model",
      }) as never,
    )

    expect(response.status).toBe(200)
    const events = parseSse(await response.text())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(events.filter((event) => event.type === "content")).toEqual([])
    expect(events).toContainEqual({
      type: "error",
      data: "Could not complete the update automatically. The previous page was kept.",
    })
  })
})