import { NextResponse } from "next/server"
import { getEnabledModels } from "@/lib/ai-models"

/**
 * GET /api/ai/models
 * Returns the list of enabled AI models based on environment configuration
 */
export async function GET() {
  try {
    const models = getEnabledModels()
    
    return NextResponse.json({
      models,
      count: models.length,
    })
  } catch (error) {
    console.error("Error fetching AI models:", error)
    return NextResponse.json(
      { error: "Failed to fetch AI models" },
      { status: 500 }
    )
  }
}
