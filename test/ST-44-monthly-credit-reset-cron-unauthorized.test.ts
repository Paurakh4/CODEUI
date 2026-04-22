import { beforeEach, describe, expect, it, vi } from "vitest"

const connectDB = vi.fn(async () => undefined)
const userFind = vi.fn()
const userFindByIdAndUpdate = vi.fn()

vi.mock("@/lib/db", () => ({
  default: connectDB,
}))

vi.mock("@/lib/models", () => ({
  User: {
    find: userFind,
    findByIdAndUpdate: userFindByIdAndUpdate,
  },
}))

describe("ST-44 monthly credit reset cron without valid secret", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "st-44-valid-secret"
  })

  it("rejects unauthorized requests and does not execute any reset work", async () => {
    const { POST } = await import("@/app/api/cron/reset-credits/route")

    const response = await POST(
      new Request("http://localhost:3000/api/cron/reset-credits", {
        method: "POST",
        headers: {
          authorization: "Bearer invalid-secret",
        },
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })

    expect(connectDB).not.toHaveBeenCalled()
    expect(userFind).not.toHaveBeenCalled()
    expect(userFindByIdAndUpdate).not.toHaveBeenCalled()
  })
})