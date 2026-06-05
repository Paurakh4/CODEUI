import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  AdminModelPolicyMutationError,
  getAdminModelCatalog,
  upsertAdminModelPolicy,
} from "@/lib/admin/model-policies"

const adminModelSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    sourceProvider: z.enum(["openrouter", "pxroute"]).optional(),
    description: z.string().trim().max(280).optional().default(""),
    contextLength: z.number().int().positive().max(10_000_000),
    supportsReasoning: z.boolean().optional().default(false),
    isFast: z.boolean().optional().default(false),
    isNewModel: z.boolean().optional().default(false),
    isNew: z.boolean().optional(),
  })
  .strict()

const updateAdminModelsSchema = z
  .object({
    models: z.array(adminModelSchema).min(1),
    enabledModelIds: z.array(z.string().trim().min(1)).min(1),
    defaultModelId: z.string().trim().min(1),
    promptEnhanceModelId: z.string().trim().min(1).optional(),
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
      models: parsed.data.models,
      enabledModelIds: parsed.data.enabledModelIds,
      defaultModelId: parsed.data.defaultModelId,
      promptEnhanceModelId: parsed.data.promptEnhanceModelId,
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
