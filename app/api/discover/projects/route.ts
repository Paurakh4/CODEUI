import { auth } from "@/lib/auth"
import connectDB from "@/lib/db"
import { getDiscoverSortStage, parseDiscoverQuery } from "@/lib/discover-projects"
import { Project, ProjectLike } from "@/lib/models"
import { NextResponse } from "next/server"

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const query = parseDiscoverQuery(Object.fromEntries(searchParams.entries()))

    await connectDB()

    const filters: Record<string, unknown> = { isPrivate: false }

    if (query.search) {
      filters.name = new RegExp(escapeRegex(query.search), "i")
    }

    const offset = (query.page - 1) * query.pageSize

    const [projects, totalProjects] = await Promise.all([
      Project.find(filters)
        .select("_id userId name emoji htmlContent views likes createdAt updatedAt")
        .populate("userId", "name")
        .sort(getDiscoverSortStage(query.sort))
        .skip(offset)
        .limit(query.pageSize)
        .lean(),
      Project.countDocuments(filters),
    ])

    const projectIds = projects.map((project) => project._id.toString())
    const likedProjectIds = session?.user?.id
      ? new Set(
          (
            await ProjectLike.find({
              userId: session.user.id,
              projectId: { $in: projectIds },
            })
              .select("projectId")
              .lean()
          ).map((item) => item.projectId)
        )
      : new Set<string>()

    const items = projects.map((project) => {
      const owner = project.userId as { name?: string } | null

      return {
        id: project._id.toString(),
        name: project.name,
        emoji: project.emoji,
        htmlContent: project.htmlContent,
        views: project.views,
        likes: project.likes,
        ownerName: owner?.name || "Anonymous",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        viewerHasLiked: likedProjectIds.has(project._id.toString()),
      }
    })

    const totalPages = Math.max(1, Math.ceil(totalProjects / query.pageSize))

    return NextResponse.json({
      projects: items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalProjects,
        totalPages,
        hasPreviousPage: query.page > 1,
        hasNextPage: query.page < totalPages,
      },
      filters: query,
    })
  } catch (error) {
    console.error("Error fetching discover projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch public projects" },
      { status: 500 }
    )
  }
}
