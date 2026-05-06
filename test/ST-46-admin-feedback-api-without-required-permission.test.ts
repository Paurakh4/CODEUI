import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdminRoute = vi.fn()
const getAdminFeedbackPageData = vi.fn()
const updateAdminFeedbackStatus = vi.fn()

vi.mock("@/lib/admin/guards", () => ({
  requireAdminRoute,
}))

vi.mock("@/lib/admin/feedback", () => ({
  AdminFeedbackMutationError: class AdminFeedbackMutationError extends Error {
    status = 400
  },
  getAdminFeedbackPageData,
  updateAdminFeedbackStatus,
}))

vi.mock("@/lib/admin/feedback-events", () => ({
  publishAdminFeedbackEvent: vi.fn(),
}))

describe("ST-46 admin feedback API without required permission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminRoute.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    })
  })

  it("rejects the protected admin feedback listing API", async () => {
    const { GET } = await import("@/app/api/admin/feedback/route")

    const response = await GET(
      new Request("http://localhost:3000/api/admin/feedback?status=new", {
        method: "GET",
      }),
    )

    expect(requireAdminRoute).toHaveBeenCalledWith("admin:view-feedback")
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(getAdminFeedbackPageData).not.toHaveBeenCalled()
  })

  it("rejects the protected admin feedback mutation API", async () => {
    const { PATCH } = await import("@/app/api/admin/feedback/[feedbackId]/route")

    const response = await PATCH(
      new Request("http://localhost:3000/api/admin/feedback/feedback-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "read" }),
      }),
      {
        params: Promise.resolve({ feedbackId: "feedback-1" }),
      },
    )

    expect(requireAdminRoute).toHaveBeenCalledWith("admin:manage-feedback")
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(updateAdminFeedbackStatus).not.toHaveBeenCalled()
  })
})