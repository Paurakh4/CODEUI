import connectDB from "@/lib/db"
import { buildViewerFingerprint, getViewWindowKey } from "@/lib/discover-projects"
import { Project, ProjectView } from "@/lib/models"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    await connectDB()

    const project = await Project.findOne({ _id: id, isPrivate: false })
      .select("_id views")
      .lean()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip")
    const viewerFingerprint = buildViewerFingerprint({
      ipAddress,
      userAgent: request.headers.get("user-agent"),
      acceptLanguage: request.headers.get("accept-language"),
    })
    const windowKey = getViewWindowKey()

    let counted = false

    try {
      await ProjectView.create({
        projectId: id,
        viewerFingerprint,
        windowKey,
      })
      await Project.updateOne({ _id: id }, { $inc: { views: 1 } })
      counted = true
    } catch (error) {
      const duplicateError = error as { code?: number }
      if (duplicateError.code !== 11000) {
        throw error
      }
    }

    const refreshedProject = await Project.findById(id).select("views").lean()

    return NextResponse.json({
      counted,
      views: refreshedProject?.views ?? project.views,
    })
  } catch (error) {
    console.error("Error incrementing project view:", error)
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 }
    )
  }
}
