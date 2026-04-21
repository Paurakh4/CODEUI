import { auth } from "@/lib/auth"
import connectDB from "@/lib/db"
import { Project, ProjectLike } from "@/lib/models"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params

    await connectDB()

    const project = await Project.findOne({ _id: id, isPrivate: false })
      .select("_id userId name emoji htmlContent views likes createdAt updatedAt")
      .populate("userId", "name")
      .lean()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const viewerHasLiked = session?.user?.id
      ? Boolean(
          await ProjectLike.findOne({
            projectId: id,
            userId: session.user.id,
          })
            .select("_id")
            .lean()
        )
      : false

    const owner = project.userId as { name?: string } | null

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        emoji: project.emoji,
        htmlContent: project.htmlContent,
        views: project.views,
        likes: project.likes,
        ownerName: owner?.name || "Anonymous",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        viewerHasLiked,
      },
    })
  } catch (error) {
    console.error("Error fetching public project:", error)
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    )
  }
}
