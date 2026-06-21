import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  ENV_SETTINGS_SCHEMA,
  EnvSettingsMutationError,
  getEnvSettings,
  updateEnvSettings,
} from "@/lib/admin/env-settings"

const envKeySchema = z.enum(
  ENV_SETTINGS_SCHEMA.map((d) => d.key) as [string, ...string[]],
)

const updateEnvSettingsSchema = z
  .object({
    changes: z.record(envKeySchema, z.string()).refine(
      (changes) => Object.keys(changes).length > 0,
      "Provide at least one change.",
    ),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function GET() {
  const authResult = await requireAdminRoute("admin:manage-settings")
  if ("response" in authResult) return authResult.response

  const settings = await getEnvSettings()
  return NextResponse.json(
    { settings },
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
  const authResult = await requireAdminRoute("admin:manage-settings")
  if ("response" in authResult) return authResult.response

  const body = await request.json().catch(() => null)
  const parsed = updateEnvSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid env settings update", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const settings = await updateEnvSettings({
      actor: authResult.session.user,
      changes: parsed.data.changes,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof EnvSettingsMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("ADMIN_ENV_SETTINGS_PATCH_ERROR", error)
    return NextResponse.json(
      { error: "Failed to update env settings" },
      { status: 500 },
    )
  }
}
