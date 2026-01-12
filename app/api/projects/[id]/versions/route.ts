import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Project } from "@/lib/models";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/versions - Get all versions for a project
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const project = await Project.findOne(
      { _id: id, userId: session.user.id },
      { versions: 1 }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ versions: project.versions || [] });
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/versions - Add a new version to a project
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await request.json();

    if (!body.htmlContent) {
      return NextResponse.json(
        { error: "Missing required field: htmlContent" },
        { status: 400 }
      );
    }

    const version = {
      htmlContent: body.htmlContent,
      description: body.description || "",
      createdAt: new Date(),
    };

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      {
        $push: { versions: version },
        $set: { htmlContent: body.htmlContent }, // Also update current content
      },
      { new: true, projection: { versions: { $slice: -1 } } }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { version: project.versions[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding version:", error);
    return NextResponse.json(
      { error: "Failed to add version" },
      { status: 500 }
    );
  }
}
