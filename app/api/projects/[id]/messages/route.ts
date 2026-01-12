import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Project } from "@/lib/models";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/messages - Get all messages for a project
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
      { messages: 1 }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ messages: project.messages || [] });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/messages - Add a message to a project
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await request.json();

    if (!body.role || !body.content) {
      return NextResponse.json(
        { error: "Missing required fields: role, content" },
        { status: 400 }
      );
    }

    const message = {
      role: body.role as "user" | "assistant",
      content: body.content,
      thinkingContent: body.thinkingContent,
      createdAt: new Date(),
    };

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { $push: { messages: message } },
      { new: true, projection: { messages: { $slice: -1 } } }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: project.messages[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding message:", error);
    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/messages - Clear all messages for a project
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { $set: { messages: [] } },
      { new: true }
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing messages:", error);
    return NextResponse.json(
      { error: "Failed to clear messages" },
      { status: 500 }
    );
  }
}
