import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import {
  detectMediaKind,
  MAX_MEDIA_UPLOAD_SIZE_BYTES,
  resolveSafeExtension,
  sanitizeDisplayFileName,
} from "@/lib/media";
import { MediaAsset, type MediaKind, Project } from "@/lib/models";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function toMediaResponse(media: {
  _id: { toString(): string };
  projectId: string;
  kind: MediaKind;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: media._id.toString(),
    projectId: media.projectId,
    kind: media.kind,
    originalName: media.originalName,
    mimeType: media.mimeType,
    size: media.size,
    url: media.url,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

async function assertProjectAccess(projectId: string, userId: string) {
  const projectExists = await Project.exists({ _id: projectId, userId });
  return Boolean(projectExists);
}

// GET /api/projects/[id]/media - List media for a project
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const hasAccess = await assertProjectAccess(id, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get("kind");

    const query: { userId: string; projectId: string; kind?: MediaKind } = {
      userId: session.user.id,
      projectId: id,
    };

    if (kindParam) {
      if (!["image", "video", "audio"].includes(kindParam)) {
        return NextResponse.json(
          { error: "Invalid media kind" },
          { status: 400 }
        );
      }
      query.kind = kindParam as MediaKind;
    }

    const media = await MediaAsset.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ media: media.map(toMediaResponse) });
  } catch (error) {
    console.error("Error listing media assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch media assets" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/media - Upload a media file
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const hasAccess = await assertProjectAccess(id, session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required in form field 'file'" },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Cannot upload an empty file" },
        { status: 400 }
      );
    }

    if (file.size > MAX_MEDIA_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large. Max size is ${Math.floor(
            MAX_MEDIA_UPLOAD_SIZE_BYTES / (1024 * 1024)
          )}MB`,
        },
        { status: 413 }
      );
    }

    const kind = detectMediaKind(file.type || "");

    if (!kind) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    const originalName = sanitizeDisplayFileName(file.name || "untitled");
    const extension = resolveSafeExtension(originalName, kind);
    const generatedFileName = `${Date.now()}-${randomUUID()}${extension}`;
    const mediaFolder = `${kind}s`;

    const storageDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      session.user.id,
      id,
      mediaFolder
    );
    await mkdir(storageDir, { recursive: true });

    const absoluteFilePath = path.join(storageDir, generatedFileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absoluteFilePath, fileBuffer);

    const storagePath = path.posix.join(
      "uploads",
      session.user.id,
      id,
      mediaFolder,
      generatedFileName
    );
    const url = `/${storagePath}`;

    const asset = await MediaAsset.create({
      userId: session.user.id,
      projectId: id,
      kind,
      originalName,
      mimeType: file.type,
      size: file.size,
      fileName: generatedFileName,
      url,
      storagePath,
    });

    return NextResponse.json({ asset: toMediaResponse(asset) }, { status: 201 });
  } catch (error) {
    console.error("Error uploading media asset:", error);
    return NextResponse.json(
      { error: "Failed to upload media asset" },
      { status: 500 }
    );
  }
}
