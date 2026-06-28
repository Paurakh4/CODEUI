import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPublicModelCatalog, getPublicModelCatalogForUser } from "@/lib/admin/model-policies"

/**
 * GET /api/ai/models
 * Returns the list of enabled AI models based on environment configuration.
 * For authenticated users, also includes their BYOK (Bring Your Own Key) models.
 */
export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id

    const catalog = userId
      ? await getPublicModelCatalogForUser(userId)
      : await getPublicModelCatalog()

    return NextResponse.json({
      models: catalog.models,
      count: catalog.models.length,
      defaultModelId: catalog.defaultModelId,
    })
  } catch (error) {
    console.error("Error fetching AI models:", error)
    return NextResponse.json(
      { error: "Failed to fetch AI models" },
      { status: 500 }
    )
  }
}
