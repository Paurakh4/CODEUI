import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isAdminRole, resolveUserRole } from "@/lib/admin/rbac";
import connectDB from "@/lib/db";
import { Project, User } from "@/lib/models";
import { deriveProjectNameFromPrompt, normalizeProjectName } from "@/lib/utils/project-name";
import { normalizeUserPreferences } from "@/lib/user-preferences";

const FREE_TIER_PROJECT_LIMIT = 4;

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Fetch user's projects from MongoDB
    const projects = await Project.find({ userId: session.user.id })
      .select("_id name emoji htmlContent isPrivate isFavorite views likes createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    // Transform _id to id for frontend compatibility
    const transformedProjects = projects.map((project) => ({
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

    const user = await User.findById(session.user.id)
      .select("subscription.tier email preferences role")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userTier = user.subscription?.tier || "free";
    const userEmail = user.email || session.user.email || "";
    const effectiveRole = resolveUserRole(user.role, userEmail);
    const adminBypass = isAdminRole(effectiveRole);

    if (userTier === "free" && !adminBypass) {
      const activeProjectCount = await Project.countDocuments({
        userId: session.user.id,
      });

      if (activeProjectCount >= FREE_TIER_PROJECT_LIMIT) {
        return NextResponse.json(
          {
            error: `Free tier allows up to ${FREE_TIER_PROJECT_LIMIT} active projects. Delete an existing project or upgrade to Pro for unlimited projects.`,
            code: "FREE_PROJECT_LIMIT_REACHED",
            tier: userTier,
            limit: FREE_TIER_PROJECT_LIMIT,
            currentCount: activeProjectCount,
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
    const projectName = normalizeProjectName(
      typeof body.name === "string" ? body.name : undefined,
      deriveProjectNameFromPrompt(prompt)
    );
    const preferences = normalizeUserPreferences(user.preferences);
    const defaultPrivateSetting =
      preferences.privacyPreferences.privateProjectsByDefault;

    // Create a new project in MongoDB
    const newProject = await Project.create({
      _id: body.id, // Use provided ID (UUID)
      userId: session.user.id,
      name: projectName,
      emoji: body.emoji || "🎨",
      htmlContent: body.htmlContent || "",
      isPrivate:
        typeof body.isPrivate === "boolean"
          ? body.isPrivate
          : defaultPrivateSetting,
    });

    return NextResponse.json(
      {
        project: {
          id: newProject._id.toString(),
          name: newProject.name,
          emoji: newProject.emoji,
          htmlContent: newProject.htmlContent,
          isPrivate: newProject.isPrivate,
          isFavorite: newProject.isFavorite,
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
