import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  listUserProviders,
  createUserProvider,
} from "@/lib/byok/user-providers"

const createProviderSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    baseUrl: z.string().trim().min(8).max(300),
    apiKey: z.string().trim().min(1).max(500),
  })
  .strict()

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const providers = await listUserProviders(session.user.id)
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
  } catch (error) {
    console.error("Error fetching user providers:", error)
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    const provider = await createUserProvider(session.user.id, {
      name: parsed.data.name,
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
    })
    return NextResponse.json({ provider }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create provider"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
