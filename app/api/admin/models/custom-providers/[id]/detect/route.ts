import { NextResponse } from "next/server"
import { requireAdminRoute } from "@/lib/admin/guards"
import { detectCustomProviderModels } from "@/lib/admin/custom-providers"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminRoute("admin:view-models")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing provider id" }, { status: 400 })
  }

  try {
    const result = await detectCustomProviderModels({ id })
    return NextResponse.json(
      { provider: result.provider, models: result.models },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to detect models"
    const status = message.includes("not found") ? 404 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
