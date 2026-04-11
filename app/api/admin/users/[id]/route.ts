import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  type AccountStatus,
  type UserRole,
} from "@/lib/admin/rbac"
import {
  AdminUserMutationError,
  getAdminUserDetail,
  updateAdminUserById,
} from "@/lib/admin/users"
import type { SubscriptionTier } from "@/lib/pricing"

const SUBSCRIPTION_TIERS: [SubscriptionTier, SubscriptionTier, SubscriptionTier] = [
  "free",
  "pro",
  "proplus",
]

const updateAdminUserSchema = z
  .object({
    role: z.enum(USER_ROLES as unknown as [UserRole, ...UserRole[]]).optional(),
    accountStatus: z
      .enum(ACCOUNT_STATUSES as unknown as [AccountStatus, ...AccountStatus[]])
      .optional(),
    subscriptionTier: z.enum(SUBSCRIPTION_TIERS).optional(),
    monthlyCredits: z.number().int().min(0).max(1_000_000).optional(),
    topupCredits: z.number().int().min(0).max(1_000_000).optional(),
    adminNotes: z.string().trim().max(4000).optional(),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).every((key) => key === "reason")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must change.",
        path: ["reason"],
      })
    }
  })

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAdminRoute("admin:view-customers")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await params
  const detail = await getAdminUserDetail(id)

  if (!detail) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(
    { customer: detail },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireAdminRoute("admin:manage-users")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateAdminUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid customer update",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const detail = await updateAdminUserById({
      userId: id,
      actor: authResult.session.user,
      changes: parsed.data,
    })

    return NextResponse.json({ customer: detail })
  } catch (error) {
    if (error instanceof AdminUserMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("ADMIN_USER_PATCH_ERROR", error)
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 },
    )
  }
}