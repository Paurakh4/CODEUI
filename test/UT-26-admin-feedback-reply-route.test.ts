import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdminRoute = vi.fn()
const updateAdminFeedbackStatus = vi.fn()
const publishAdminFeedbackEvent = vi.fn()

vi.mock("@/lib/admin/guards", () => ({
  requireAdminRoute,
}))

vi.mock("@/lib/admin/feedback", () => ({
  AdminFeedbackMutationError: class AdminFeedbackMutationError extends Error {
    status = 400
  },
  updateAdminFeedbackStatus,
}))

vi.mock("@/lib/admin/feedback-events", () => ({
  publishAdminFeedbackEvent,
}))

describe("UT-26 admin feedback reply route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminRoute.mockResolvedValue({
      session: {
        user: {
          id: "admin-1",
          email: "admin@example.com",
          role: "admin",
        },
      },
    })
  })

  it("accepts reply details and publishes a realtime update event", async () => {
    updateAdminFeedbackStatus.mockResolvedValue({
      changed: true,
      previousStatus: "read",
      feedback: {
        id: "feedback-1",
        status: "responded",
        updatedAt: "2026-05-01T12:00:00.000Z",
      },
      emailDelivery: {
        status: "sent",
      },
    })

    const { PATCH } = await import("@/app/api/admin/feedback/[feedbackId]/route")

    const response = await PATCH(
      new Request("http://localhost:3000/api/admin/feedback/feedback-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "responded",
          adminNote: "Bug fixed in staging.",
          responseMessage: "We found the issue and shipped a fix.",
          sendEmail: true,
        }),
      }),
      {
        params: Promise.resolve({ feedbackId: "feedback-1" }),
      },
    )

    expect(updateAdminFeedbackStatus).toHaveBeenCalledWith({
      feedbackId: "feedback-1",
      status: "responded",
      actor: {
        id: "admin-1",
        email: "admin@example.com",
        role: "admin",
      },
      adminNote: "Bug fixed in staging.",
      responseMessage: "We found the issue and shipped a fix.",
      sendEmail: true,
    })
    expect(publishAdminFeedbackEvent).toHaveBeenCalledWith({
      type: "feedback.updated",
      data: {
        feedbackId: "feedback-1",
        status: "responded",
        previousStatus: "read",
        updatedAt: "2026-05-01T12:00:00.000Z",
      },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      changed: true,
      previousStatus: "read",
      feedback: {
        id: "feedback-1",
        status: "responded",
        updatedAt: "2026-05-01T12:00:00.000Z",
      },
      emailDelivery: {
        status: "sent",
      },
    })
  })

  it("rejects sendEmail requests without a response message", async () => {
    const { PATCH } = await import("@/app/api/admin/feedback/[feedbackId]/route")

    const response = await PATCH(
      new Request("http://localhost:3000/api/admin/feedback/feedback-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "responded",
          sendEmail: true,
        }),
      }),
      {
        params: Promise.resolve({ feedbackId: "feedback-1" }),
      },
    )

    expect(response.status).toBe(400)
    expect(updateAdminFeedbackStatus).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid feedback update",
    })
  })
})