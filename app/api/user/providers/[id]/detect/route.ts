import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { detectUserProviderModels } from "@/lib/byok/user-providers"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
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

  try {
    const result = await detectUserProviderModels(session.user.id, id)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to detect models"
    const status = message.includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
