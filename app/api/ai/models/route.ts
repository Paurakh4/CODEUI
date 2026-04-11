import { NextResponse } from "next/server"
import { getPublicModelCatalog } from "@/lib/admin/model-policies"

/**
 * GET /api/ai/models
 * Returns the list of enabled AI models based on environment configuration
 */
export async function GET() {
  try {
    const catalog = await getPublicModelCatalog()
    
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
