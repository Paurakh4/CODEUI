import { beforeEach, describe, expect, it, vi } from "vitest"

const connectDB = vi.fn(async () => undefined)
const feedbackFind = vi.fn()
const feedbackCountDocuments = vi.fn()
const userFind = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@/lib/db", () => ({
  default: connectDB,
}))

vi.mock("@/lib/admin/audit", () => ({
  createAdminAuditEntry: vi.fn(),
}))

vi.mock("@/lib/feedback-email", () => ({
  sendFeedbackResponseEmail: vi.fn(),
}))

vi.mock("@/lib/models", () => ({
  Feedback: {
    find: feedbackFind,
    countDocuments: feedbackCountDocuments,
  },
  User: {
    find: userFind,
  },
}))

function createFindChain<T>(result: T) {
  const chain = {
    select: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(async () => result),
  }

  return chain
}

function createUserFindChain<T>(result: T) {
  const chain = {
    select: vi.fn(() => chain),
    lean: vi.fn(async () => result),
  }

  return chain
}

describe("UT-27 admin feedback page data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("falls back to the feedback object id timestamp when legacy rows are missing timestamps", async () => {
    const feedbackId = "6647229b0000000000000001"
    const derivedIso = new Date(Number.parseInt(feedbackId.slice(0, 8), 16) * 1000).toISOString()

    feedbackFind.mockReturnValue(
      createFindChain([
        {
          _id: { toString: () => feedbackId },
          userId: { toString: () => "user-1" },
          type: "bug",
          status: "new",
          message: "The admin feedback page crashes when loading old entries.",
        },
      ]),
    )
    feedbackCountDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    userFind.mockReturnValue(
      createUserFindChain([
        {
          _id: { toString: () => "user-1" },
          name: "Legacy User",
          email: "legacy@example.com",
        },
      ]),
    )

    const { getAdminFeedbackPageData } = await import("@/lib/admin/feedback")

    const result = await getAdminFeedbackPageData({
      status: "all",
      page: 1,
      pageSize: 25,
    })

    expect(connectDB).toHaveBeenCalledTimes(1)
    expect(result.feedback).toHaveLength(1)
    expect(result.feedback[0]).toMatchObject({
      id: feedbackId,
      createdAt: derivedIso,
      updatedAt: derivedIso,
      preview: "The admin feedback page crashes when loading old entries.",
      user: {
        id: "user-1",
        name: "Legacy User",
        email: "legacy@example.com",
      },
    })
  })
})