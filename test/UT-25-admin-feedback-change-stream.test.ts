import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const connectDB = vi.fn(async () => undefined)
const watch = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@/lib/db", () => ({
  default: connectDB,
}))

vi.mock("@/lib/models", () => ({
  Feedback: {
    watch,
  },
}))

function createChangeStreamMock() {
  const listeners = new Map<string, Array<(value?: unknown) => void>>()

  return {
    on: vi.fn((event: string, listener: (value?: unknown) => void) => {
      const currentListeners = listeners.get(event) ?? []
      currentListeners.push(listener)
      listeners.set(event, currentListeners)
      return undefined
    }),
    emit(event: string, value?: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(value)
      }
    },
    removeAllListeners: vi.fn(() => undefined),
    close: vi.fn(async () => undefined),
  }
}

describe("UT-25 admin feedback change stream", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    const module = await import("@/lib/admin/feedback-events")
    module.resetAdminFeedbackEventStateForTests()
  })

  it("subscribes to MongoDB feedback changes and forwards insert events", async () => {
    const changeStream = createChangeStreamMock()
    watch.mockReturnValue(changeStream)

    const module = await import("@/lib/admin/feedback-events")
    const listener = vi.fn()
    const unsubscribe = module.subscribeToAdminFeedback(listener)

    await Promise.resolve()
    await Promise.resolve()

    expect(connectDB).toHaveBeenCalledTimes(1)
    expect(watch).toHaveBeenCalledTimes(1)

    changeStream.emit("change", {
      operationType: "insert",
      fullDocument: {
        _id: { toString: () => "feedback-2" },
        type: "feature",
        status: "new",
        createdAt: new Date("2026-05-01T10:30:00.000Z"),
      },
    })

    expect(listener).toHaveBeenCalledWith({
      type: "feedback.created",
      data: {
        feedbackId: "feedback-2",
        feedbackType: "feature",
        status: "new",
        createdAt: "2026-05-01T10:30:00.000Z",
      },
    })

    unsubscribe()
  })

  it("suppresses duplicate change-stream updates for locally published events", async () => {
    const changeStream = createChangeStreamMock()
    watch.mockReturnValue(changeStream)

    const module = await import("@/lib/admin/feedback-events")
    const listener = vi.fn()
    const unsubscribe = module.subscribeToAdminFeedback(listener)

    await Promise.resolve()
    await Promise.resolve()

    module.publishAdminFeedbackEvent({
      type: "feedback.updated",
      data: {
        feedbackId: "feedback-1",
        status: "read",
        updatedAt: "2026-05-01T11:00:00.000Z",
      },
    })

    changeStream.emit("change", {
      operationType: "update",
      fullDocument: {
        _id: { toString: () => "feedback-1" },
        status: "read",
        updatedAt: new Date("2026-05-01T11:00:00.000Z"),
      },
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({
      type: "feedback.updated",
      data: {
        feedbackId: "feedback-1",
        status: "read",
        updatedAt: "2026-05-01T11:00:00.000Z",
      },
    })

    unsubscribe()
  })
})