import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { normalizeHtml } from "@/lib/reprompting/normalize-html"

const auth = vi.fn()
const connectDB = vi.fn(async () => undefined)
const userFindById = vi.fn()
const userFindByIdAndUpdate = vi.fn()
const usageLogCreate = vi.fn(async () => undefined)
const getRuntimeDefaultModelId = vi.fn(async () => "test-model")
const getRuntimeModelById = vi.fn(async (id: string) => ({ id, contextLength: 64_000 }))
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
  getRuntimeModelById,
  getRuntimeModelFallbackChain,
  isRuntimeModelEnabled,
}))

vi.mock("@/lib/admin/rbac", () => ({
  isInternalUserRole,
  resolveUserRole,
}))

const PRIOR_HTML = `<!DOCTYPE html><html><body><main><h1>Original heading</h1><p>Original copy.</p></main></body></html>`

const UPDATED_HTML = `<!DOCTYPE html><html><body><main><h1>Updated heading</h1><p>Updated copy.</p></main></body></html>`

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
      "x-codeui-request-id": `cross-model-${Math.random().toString(36).slice(2, 8)}`,
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

async function runFollowUp({
  rawContent,
  model,
}: {
  rawContent: string
  model: string
}) {
  const fetchMock = vi.fn().mockResolvedValueOnce(createOpenRouterStream(rawContent))
  global.fetch = fetchMock

  const { POST } = await import("@/app/api/ai/route")
  const response = await POST(
    createRequest({
      prompt: "update the heading and copy to say 'Updated'",
      currentHtml: PRIOR_HTML,
      isFollowUp: true,
      model,
    }) as never,
  )

  const events = parseSse(await response.text())
  return {
    response,
    events,
    fetchCallCount: fetchMock.mock.calls.length,
  }
}

describe("UT-30 cross-model reprompt route", () => {
  const originalFetch = global.fetch
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "ut-30-openrouter-key"
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

  it("Gemini-style clean HTML: emits the document directly without retries", async () => {
    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: UPDATED_HTML,
      model: "google/gemini-3-flash-preview",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents).toEqual([{ type: "content", data: normalizeHtml(UPDATED_HTML) }])
    expect(events.some((event) => event.type === "error")).toBe(false)
  })

  it("DeepSeek R1 thinking-tag prefix: strips reasoning and emits clean HTML", async () => {
    const raw = `<think>The user wants the heading and copy updated. I should keep the existing structure.</think>\n${UPDATED_HTML}`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "deepseek/deepseek-r1",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1) // No retry needed, finalizer handled it
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents).toEqual([{ type: "content", data: normalizeHtml(UPDATED_HTML) }])
  })

  it("Kimi K2 Thinking: handles <reasoning> wrapper", async () => {
    const raw = `<reasoning>I will modify the h1 and the p.</reasoning>${UPDATED_HTML}`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "moonshotai/kimi-k2-thinking",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents).toEqual([{ type: "content", data: normalizeHtml(UPDATED_HTML) }])
  })

  it("Claude Haiku narration + fenced HTML: extracts the fenced document", async () => {
    const raw = `Here is the updated page with your requested changes:\n\n\`\`\`html\n${UPDATED_HTML}\n\`\`\`\n\nLet me know if you want anything else!`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "anthropic/claude-haiku-4.5",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents).toEqual([{ type: "content", data: normalizeHtml(UPDATED_HTML) }])
  })

  it("DeepSeek-Chat patch-style output: applies SEARCH/REPLACE against current HTML", async () => {
    const raw = `<<<<<<< SEARCH
<h1>Original heading</h1>
=======
<h1>Updated heading</h1>
>>>>>>> REPLACE

<<<<<<< SEARCH
<p>Original copy.</p>
=======
<p>Updated copy.</p>
>>>>>>> REPLACE`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "deepseek/deepseek-chat",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents.length).toBe(1)
    const data = contentEvents[0].data as string
    expect(data).toContain("Updated heading")
    expect(data).toContain("Updated copy")
    expect(data).not.toContain("Original heading")
    expect(/^<!DOCTYPE html>/i.test(data.trim())).toBe(true)
    expect(/<\/html>\s*$/i.test(data.trim())).toBe(true)
  })

  it("GLM 4.7 verbose narration with embedded HTML: extracts the doc", async () => {
    const raw = `Sure, I'll make the change.\n\nThe modified document is below:\n\n${UPDATED_HTML}\n\nThat's the complete updated page.`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "z-ai/glm-4.7",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents).toEqual([{ type: "content", data: normalizeHtml(UPDATED_HTML) }])
  })

  it("Devstral fenced+truncated output: recovers a doc with no closing fence", async () => {
    const raw = `\`\`\`html\n${UPDATED_HTML}`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "mistralai/devstral-2512:free",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    const contentEvents = events.filter((event) => event.type === "content")
    expect(contentEvents).toEqual([{ type: "content", data: normalizeHtml(UPDATED_HTML) }])
  })

  it("rolls back to the prior page when the model returns only narration (no HTML, no patches)", async () => {
    const fetchMock = vi
      .fn()
      // First call: useless narration
      .mockResolvedValueOnce(createOpenRouterStream("I have made the requested changes."))
      // Hidden retry: also useless narration
      .mockResolvedValueOnce(createOpenRouterStream("All set!"))
    global.fetch = fetchMock

    const { POST } = await import("@/app/api/ai/route")
    const response = await POST(
      createRequest({
        prompt: "swap the heading",
        currentHtml: PRIOR_HTML,
        isFollowUp: true,
        model: "anthropic/claude-haiku-4.5",
      }) as never,
    )

    expect(response.status).toBe(200)
    const events = parseSse(await response.text())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // No content event should be emitted: the frontend keeps the previous page.
    expect(events.filter((event) => event.type === "content")).toEqual([])
    expect(events).toContainEqual({
      type: "error",
      data: "Could not complete the update automatically. The previous page was kept.",
    })
  })

  it("does not invoke a hidden retry when the first response is recoverable", async () => {
    // Patch-only response is recoverable in-memory via the finalizer, so the
    // route should not waste an extra OpenRouter call.
    const raw = `Here you go:\n<<<<<<< SEARCH\n<h1>Original heading</h1>\n=======\n<h1>Updated heading</h1>\n>>>>>>> REPLACE`

    const { response, events, fetchCallCount } = await runFollowUp({
      rawContent: raw,
      model: "deepseek/deepseek-r1",
    })

    expect(response.status).toBe(200)
    expect(fetchCallCount).toBe(1)
    expect(events.filter((event) => event.type === "error")).toEqual([])
  })
})
