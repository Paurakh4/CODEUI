import { auth } from "@/lib/auth"
import connectDB from "@/lib/db"
import { Project, ProjectLike } from "@/lib/models"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    await connectDB()

    const project = await Project.findOne({ _id: id, isPrivate: false })
      .select("_id likes")
      .lean()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const existingLike = await ProjectLike.findOne({
      projectId: id,
      userId: session.user.id,
    })
      .select("_id")
      .lean()

    let liked = false

    if (existingLike) {
      await ProjectLike.deleteOne({ _id: existingLike._id })
      await Project.updateOne({ _id: id, likes: { $gt: 0 } }, { $inc: { likes: -1 } })
    } else {
      await ProjectLike.create({
        projectId: id,
        userId: session.user.id,
      })
      await Project.updateOne({ _id: id }, { $inc: { likes: 1 } })
      liked = true
    }

    const refreshedProject = await Project.findById(id).select("likes").lean()

    return NextResponse.json({
      liked,
      likes: refreshedProject?.likes ?? project.likes,
    })
  } catch (error) {
    console.error("Error toggling project like:", error)
    return NextResponse.json(
      { error: "Failed to update like" },
      { status: 500 }
    )
  }
}
