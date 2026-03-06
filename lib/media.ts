import path from "node:path";
import type { MediaKind } from "@/lib/models";

const MEDIA_MIME_TYPES: Record<MediaKind, Set<string>> = {
  image: new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
  ]),
  video: new Set([
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
  ]),
  audio: new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
    "audio/flac",
  ]),
};

const FALLBACK_EXTENSION_BY_KIND: Record<MediaKind, string> = {
  image: ".png",
  video: ".mp4",
  audio: ".mp3",
};

const MAX_UPLOAD_SIZE_MB = Number.parseInt(
  process.env.MEDIA_MAX_UPLOAD_MB || "25",
  10
);

export const MAX_MEDIA_UPLOAD_SIZE_BYTES =
  Number.isFinite(MAX_UPLOAD_SIZE_MB) && MAX_UPLOAD_SIZE_MB > 0
    ? MAX_UPLOAD_SIZE_MB * 1024 * 1024
    : 25 * 1024 * 1024;

export function detectMediaKind(mimeType: string): MediaKind | null {
  const normalized = mimeType.toLowerCase().trim();

  if (MEDIA_MIME_TYPES.image.has(normalized)) {
    return "image";
  }

  if (MEDIA_MIME_TYPES.video.has(normalized)) {
    return "video";
  }

  if (MEDIA_MIME_TYPES.audio.has(normalized)) {
    return "audio";
  }

  return null;
}

export function sanitizeDisplayFileName(fileName: string): string {
  const trimmed = path.basename(fileName).trim();
  return trimmed || "untitled";
}

export function resolveSafeExtension(
  originalName: string,
  kind: MediaKind
): string {
  const ext = path.extname(originalName).toLowerCase();
  const cleaned = ext.replace(".", "");

  if (cleaned && /^[a-z0-9]{1,8}$/i.test(cleaned)) {
    return `.${cleaned}`;
  }

  return FALLBACK_EXTENSION_BY_KIND[kind];
}
