import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdminRoute = vi.fn()
const resyncAdminBillingAccount = vi.fn()

vi.mock("@/lib/admin/guards", () => ({
  requireAdminRoute,
}))

vi.mock("@/lib/admin/billing", () => ({
  AdminBillingMutationError: class AdminBillingMutationError extends Error {
    status = 400
  },
  resyncAdminBillingAccount,
}))

describe("ST-45 admin API without required permission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminRoute.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    })
  })

  it("rejects the protected admin billing API and does not execute the privileged action", async () => {
    const { POST } = await import("@/app/api/admin/billing/resync/route")

    const response = await POST(
      new Request("http://localhost:3000/api/admin/billing/resync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user_123",
          reason: "Force resync without permission",
        }),
      }),
    )

    expect(requireAdminRoute).toHaveBeenCalledWith("admin:manage-billing")
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(resyncAdminBillingAccount).not.toHaveBeenCalled()
  })
})