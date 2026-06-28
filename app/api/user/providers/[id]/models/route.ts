import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { enableUserProviderModels } from "@/lib/byok/user-providers"

const updateModelsSchema = z
  .object({
    models: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            name: z.string().trim().min(1),
            contextLength: z.number().nullable().optional(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Provider id is required" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateModelsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid models payload", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const provider = await enableUserProviderModels(
      session.user.id,
      id,
      parsed.data.models.map((m) => ({
        id: m.id,
        name: m.name,
        contextLength: m.contextLength ?? null,
      })),
    )
    return NextResponse.json({ provider })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update models"
    const status = message.includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
