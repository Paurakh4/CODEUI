import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  AdminModelPolicyMutationError,
  getAdminModelCatalog,
  upsertAdminModelPolicy,
} from "@/lib/admin/model-policies"

const updateAdminModelsSchema = z
  .object({
    enabledModelIds: z.array(z.string().trim().min(1)).min(1),
    defaultModelId: z.string().trim().min(1),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function GET() {
  const authResult = await requireAdminRoute("admin:view-models")
  if ("response" in authResult) {
    return authResult.response
  }

  const catalog = await getAdminModelCatalog()

  return NextResponse.json(
    { catalog },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}

export async function PATCH(request: Request) {
  const authResult = await requireAdminRoute("admin:manage-models")
  if ("response" in authResult) {
    return authResult.response
  }

  const body = await request.json().catch(() => null)
  const parsed = updateAdminModelsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid model policy update",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const catalog = await upsertAdminModelPolicy({
      actor: authResult.session.user,
      enabledModelIds: parsed.data.enabledModelIds,
      defaultModelId: parsed.data.defaultModelId,
      reason: parsed.data.reason,
    })

    return NextResponse.json({ catalog })
  } catch (error) {
    if (error instanceof AdminModelPolicyMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("ADMIN_MODELS_PATCH_ERROR", error)
    return NextResponse.json({ error: "Failed to update model policy" }, { status: 500 })
  }
}