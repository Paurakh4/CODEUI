import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Checkpoint, Project } from "@/lib/models";

const CHECKPOINT_RETENTION_LIMIT = 50;
const VALID_KINDS = new Set(["auto", "manual", "restore"]);
const VALID_TRIGGERS = new Set([
  "before-ai",
  "after-ai",
  "manual-save",
  "restore",
]);

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

    const checkpoints = await Checkpoint.find({
      projectId: id,
      userId: session.user.id,
    })
      .sort({ seq: 1 })
      .lean();

    if (checkpoints.length > 0) {
      return NextResponse.json({ versions: checkpoints });
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

    const kind = body.kind || "manual";
    const trigger = body.trigger || "manual-save";

    if (!VALID_KINDS.has(kind)) {
      return NextResponse.json(
        { error: "Invalid field: kind" },
        { status: 400 }
      );
    }

    if (!VALID_TRIGGERS.has(trigger)) {
      return NextResponse.json(
        { error: "Invalid field: trigger" },
        { status: 400 }
      );
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      {
        $inc: { checkpointCount: 1 },
        $set: { htmlContent: body.htmlContent },
      },
      { new: true, projection: { checkpointCount: 1 } }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const checkpoint = await Checkpoint.create({
      projectId: id,
      userId: session.user.id,
      seq: project.checkpointCount,
      htmlContent: body.htmlContent,
      description: body.description || "",
      kind,
      trigger,
      restoredFromId: body.restoredFromId || undefined,
    });

    await Project.updateOne(
      { _id: id, userId: session.user.id },
      { $set: { latestCheckpointId: checkpoint._id } }
    );

    const staleCheckpoints = await Checkpoint.find({
      projectId: id,
      userId: session.user.id,
    })
      .sort({ seq: -1 })
      .skip(CHECKPOINT_RETENTION_LIMIT)
      .select({ _id: 1 })
      .lean();

    if (staleCheckpoints.length > 0) {
      await Checkpoint.deleteMany({
        _id: { $in: staleCheckpoints.map((item) => item._id) },
      });
    }

    return NextResponse.json(
      { version: checkpoint },
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
