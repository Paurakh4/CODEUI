import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  AdminBillingMutationError,
  resyncAdminBillingAccount,
} from "@/lib/admin/billing"

const resyncBillingSchema = z
  .object({
    userId: z.string().trim().min(1),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const authResult = await requireAdminRoute("admin:manage-billing")
  if ("response" in authResult) {
    return authResult.response
  }

  const body = await request.json().catch(() => null)
  const parsed = resyncBillingSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid billing resync request",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const result = await resyncAdminBillingAccount({
      userId: parsed.data.userId,
      actor: authResult.session.user,
      reason: parsed.data.reason,
    })

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof AdminBillingMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("ADMIN_BILLING_RESYNC_ERROR", error)
    return NextResponse.json({ error: "Failed to resync billing" }, { status: 500 })
  }
}