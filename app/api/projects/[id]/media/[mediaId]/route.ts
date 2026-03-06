import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { MediaAsset, Project } from "@/lib/models";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string; mediaId: string }>;
}

async function assertProjectAccess(projectId: string, userId: string) {
  const projectExists = await Project.exists({ _id: projectId, userId });
  return Boolean(projectExists);
}

// DELETE /api/projects/[id]/media/[mediaId] - Delete a media file
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id, mediaId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const hasAccess = await assertProjectAccess(id, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const asset = await MediaAsset.findOneAndDelete({
      _id: mediaId,
      userId: session.user.id,
      projectId: id,
    }).lean();

    if (!asset) {
      return NextResponse.json(
        { error: "Media asset not found" },
        { status: 404 }
      );
    }

    const absolutePath = path.join(process.cwd(), "public", asset.storagePath);

    try {
      await unlink(absolutePath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code !== "ENOENT") {
        console.error("Failed to remove media file from disk:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media asset:", error);
    return NextResponse.json(
      { error: "Failed to delete media asset" },
      { status: 500 }
    );
  }
}
