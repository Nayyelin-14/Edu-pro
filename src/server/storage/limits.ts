/**
 * Upload policy limits and format allowlists (spec §6).
 *
 * The browser's MIME type / extension are UX hints only. Authoritative checks:
 *  - size: enforced against provider-reported metadata at completion
 *  - format: enforced against the format the PROVIDER detected from actual
 *    bytes (Cloudinary parses the real container; a renamed .exe cannot
 *    masquerade as mp4/pdf), plus client-side magic-byte pre-checks where the
 *    file passes through our server (legacy /api/uploads).
 */

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

import { badRequest, payloadTooLarge } from "@/lib/errors";
import type { AssetKind } from "./types";

/** Maximum video upload size (bytes). Default 2 GiB. */
export const VIDEO_MAX_BYTES = num(process.env.UPLOAD_VIDEO_MAX_BYTES, 2 * 1024 ** 3);

/** Maximum PDF upload size (bytes). Default 50 MiB. */
export const PDF_MAX_BYTES = num(process.env.UPLOAD_PDF_MAX_BYTES, 50 * 1024 ** 2);

/** Formats the existing HTML5 player + Cloudinary pipeline handle reliably. */
export const VIDEO_ALLOWED_FORMATS = new Set(["mp4", "mov", "webm"]);

/** READING/PDF lessons accept exactly one format: pdf. */
export const PDF_ALLOWED_FORMATS = new Set(["pdf"]);

export function assertFormatAllowed(kind: AssetKind, format: string | null): void {
  const allowed = kind === "VIDEO" ? VIDEO_ALLOWED_FORMATS : PDF_ALLOWED_FORMATS;
  if (!format || !allowed.has(format.toLowerCase())) {
    throw badRequest(
      kind === "VIDEO"
        ? "Unsupported video format. Upload MP4, MOV or WebM."
        : "Unsupported file. Upload a PDF document.",
    );
  }
}

export function assertSizeAllowed(kind: AssetKind, bytes: number | null): void {
  if (bytes === null) throw badRequest("Upload verification failed: missing file size");
  const max = kind === "VIDEO" ? VIDEO_MAX_BYTES : PDF_MAX_BYTES;
  if (bytes > max) {
    throw payloadTooLarge(
      `File is too large (${formatBytes(bytes)}). Maximum allowed: ${formatBytes(max)}.`,
    );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
