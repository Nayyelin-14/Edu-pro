/**
 * Upload validation at the trust boundary.
 *
 * The declared content type is attacker-controlled, so it is never trusted.
 * Files must match an allowlisted image/video format by magic bytes
 * (sniffed with `file-type`). Anything undetectable or off-list is rejected —
 * fail closed — rather than passed through to storage.
 */
import { fileTypeFromBuffer } from "file-type";
import { badRequest } from "./errors";

export type UploadKind = "image" | "video";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/** Whether a folder may contain videos (avatars are image-only). */
export function folderAllowsVideos(folder: string): boolean {
  return folder === "courses" || folder === "lessons";
}

/**
 * Validates a file buffer by magic bytes and returns the resource type for
 * Cloudinary. Throws badRequest for anything outside the allowlist.
 */
export async function validateUpload(
  buffer: Buffer,
  folder: string,
): Promise<{ resourceType: "image" | "video"; detectedMime: string }> {
  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime;
  if (ALLOWED_IMAGE_MIMES.has(mime ?? "")) {
    return { resourceType: "image", detectedMime: mime as string };
  }
  if (
    folderAllowsVideos(folder) &&
    ALLOWED_VIDEO_MIMES.has(mime ?? "")
  ) {
    return { resourceType: "video", detectedMime: mime as string };
  }
  throw badRequest("File type is not allowed. Upload a PNG, JPEG, WebP or GIF image (or MP4/MOV/WebM video in courses).");
}