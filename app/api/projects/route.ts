import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Project } from "@/lib/models";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Fetch user's projects from MongoDB
    const projects = await Project.find({ userId: session.user.id })
      .select("_id name emoji htmlContent isPrivate views likes createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    // Transform _id to id for frontend compatibility
    const transformedProjects = projects.map((project) => ({
      id: project._id.toString(),
      name: project.name,
      emoji: project.emoji,
      htmlContent: project.htmlContent,
      isPrivate: project.isPrivate,
      views: project.views,
      likes: project.likes,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));

    return NextResponse.json({ projects: transformedProjects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await request.json();

    // Create a new project in MongoDB
    const newProject = await Project.create({
      userId: session.user.id,
      name: body.name || "Untitled Project",
      emoji: body.emoji || "🎨",
      htmlContent: body.htmlContent || "",
      isPrivate: body.isPrivate !== false, // Default to private
    });

    return NextResponse.json(
      {
        project: {
          id: newProject._id.toString(),
          name: newProject.name,
          emoji: newProject.emoji,
          htmlContent: newProject.htmlContent,
          isPrivate: newProject.isPrivate,
          views: newProject.views,
          likes: newProject.likes,
          createdAt: newProject.createdAt,
          updatedAt: newProject.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
