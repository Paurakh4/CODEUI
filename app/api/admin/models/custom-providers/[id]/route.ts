import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import { deleteCustomProvider } from "@/lib/admin/custom-providers"

const deleteSchema = z
  .object({
    reason: z.string().trim().min(3).max(200),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminRoute("admin:manage-models")
  if ("response" in authResult) {
    return authResult.response
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing provider id" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Reason is required", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    await deleteCustomProvider({
      actor: authResult.session.user,
      id,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete provider"
    const status = message.includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
