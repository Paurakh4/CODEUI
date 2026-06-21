import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"
import {
  createCustomProvider,
  listCustomProviders,
} from "@/lib/admin/custom-providers"

const createProviderSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    baseUrl: z.string().trim().min(8).max(300),
    apiKey: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(3).max(200),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function GET() {
  const authResult = await requireAdminRoute("admin:view-models")
  if ("response" in authResult) {
    return authResult.response
  }

  const providers = await listCustomProviders()
  return NextResponse.json(
    { providers },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}

export async function POST(request: Request) {
  const authResult = await requireAdminRoute("admin:manage-models")
  if ("response" in authResult) {
    return authResult.response
  }

  const body = await request.json().catch(() => null)
  const parsed = createProviderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider payload", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const provider = await createCustomProvider({
      actor: authResult.session.user,
      name: parsed.data.name,
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ provider }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create provider"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
