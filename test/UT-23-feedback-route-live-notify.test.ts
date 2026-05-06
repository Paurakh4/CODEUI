import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()
const connectDB = vi.fn(async () => undefined)
const feedbackCreate = vi.fn()
const publishAdminFeedbackEvent = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth,
}))

vi.mock("@/lib/db", () => ({
  default: connectDB,
}))

vi.mock("@/lib/admin/feedback-events", () => ({
  publishAdminFeedbackEvent,
}))

vi.mock("@/lib/models", () => ({
  Feedback: {
    create: feedbackCreate,
  },
}))

describe("UT-23 feedback route publishes admin live event", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: "user-1" } })
    feedbackCreate.mockResolvedValue({
      _id: { toString: () => "feedback-1" },
      status: "new",
      type: "bug",
      createdAt: new Date("2026-05-01T09:30:00.000Z"),
    })
  })

  it("creates feedback and emits a feedback.created event for the admin stream", async () => {
    const { POST } = await import("@/app/api/feedback/route")

    const response = await POST(
      new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest",
        },
        body: JSON.stringify({
          type: "bug",
          message: "The export button is missing from the toolbar.",
          pathname: "/dashboard",
        }),
      }),
    )

    expect(connectDB).toHaveBeenCalledTimes(1)
    expect(feedbackCreate).toHaveBeenCalledWith({
      userId: "user-1",
      type: "bug",
      message: "The export button is missing from the toolbar.",
      pathname: "/dashboard",
      metadata: {
        userAgent: "vitest",
      },
    })
    expect(publishAdminFeedbackEvent).toHaveBeenCalledWith({
      type: "feedback.created",
      data: {
        feedbackId: "feedback-1",
        status: "new",
        feedbackType: "bug",
        createdAt: "2026-05-01T09:30:00.000Z",
      },
    })
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      success: true,
      feedbackId: "feedback-1",
      status: "new",
    })
  })
})