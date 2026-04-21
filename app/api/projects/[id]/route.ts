import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Project } from "@/lib/models";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get a single project
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const project = await Project.findOne({
      _id: id,
      userId: session.user.id,
    }).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        emoji: project.emoji,
        htmlContent: project.htmlContent,
        isPrivate: project.isPrivate,
        isFavorite: Boolean(project.isFavorite),
        views: project.views,
        likes: project.likes,
        versions: project.versions,
        messages: project.messages,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await request.json();

    // Only allow updating specific fields
    const allowedUpdates: Record<string, unknown> = {};
    if (body.name !== undefined) allowedUpdates.name = body.name;
    if (body.emoji !== undefined) allowedUpdates.emoji = body.emoji;
    if (body.htmlContent !== undefined)
      allowedUpdates.htmlContent = body.htmlContent;
    if (body.isPrivate !== undefined) allowedUpdates.isPrivate = body.isPrivate;
    if (body.isFavorite !== undefined) allowedUpdates.isFavorite = body.isFavorite;

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { $set: allowedUpdates },
      { new: true }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        emoji: project.emoji,
        htmlContent: project.htmlContent,
        isPrivate: project.isPrivate,
        isFavorite: Boolean(project.isFavorite),
        views: project.views,
        likes: project.likes,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const project = await Project.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
