/**
 * Media upload pipeline (spec §5-§9, §13-§16).
 *
 * Flow: browser asks /api/staff/uploads/sign -> server authorizes + creates
 * Asset(UPLOADING) + returns signed direct-upload credentials -> browser
 * uploads chunks DIRECTLY to Cloudinary -> browser calls
 * /api/staff/uploads/:id/complete -> server verifies the object actually
 * exists via the provider Admin API, enforces format/size policy, links the
 * lesson reference, and transitions PROCESSING (videos) -> READY.
 *
 * The Next.js server never proxies file bytes. Lesson rows store only the
 * internal reference `cloudinary:<publicId>`; students receive short-lived
 * signed delivery URLs after enrollment/tenant checks.
 */
import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import type { User } from "@/generated/prisma/client";
import type { TenantContext } from "@/server/tenant-context";
import { assertLessonOwner, assertModuleOwner } from "@/server/guards";
import { getStorageProvider } from "@/server/storage";
import {
  assertFormatAllowed,
  assertSizeAllowed,
} from "@/server/storage/limits";
import type { AssetKind } from "@/server/storage/types";
import { createMediaPublisher } from "./media.queue";

/** Signed delivery URL lifetimes. */
const VIDEO_URL_TTL_S = 60 * 60; // 1 hour — covers long lessons + seeking
const PDF_URL_TTL_S = 30 * 60;

/** Assets stuck in UPLOADING longer than this are considered abandoned. */
export const UPLOAD_STALE_HOURS = 48;
/** FAILED assets (and their files) are swept after this. */
export const FAILED_ASSET_TTL_HOURS = 7 * 24;
/** Orphaned assets (lesson cascade-deleted) are swept after this. */
export const ORPHANED_ASSET_TTL_HOURS = 24;

function log(event: string, data: Record<string, unknown>) {
  // Safe identifiers only; never secrets or signed URLs.
  console.info(`[media] ${event}`, JSON.stringify(data));
}

/** Internal lesson reference scheme for provider-backed media. */
export const cloudinaryRef = (publicId: string) => `cloudinary:${publicId}`;
export const isCloudinaryRef = (ref: string | null | undefined): ref is string =>
  !!ref && ref.startsWith("cloudinary:");

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Authorizes an upload and returns direct-upload credentials.
 *
 * Authorization chain: authenticated staff user -> active tenant membership +
 * author capability (route layer) -> lesson exists in that tenant AND is owned
 * by the caller (assertLessonOwner) -> requested kind matches lesson.type.
 * The public id is fully server-generated; clients cannot choose storage paths.
 */
export async function signUpload(
  user: User,
  ctx: TenantContext,
  input: { lessonId?: string; moduleId?: string; title?: string; kind: AssetKind; filename?: string },
) {
  // Resolve (or create) the target lesson. tenantId and courseId ALWAYS come
  // from server-resolved rows — never from client input.
  let lessonId: string;
  let tenantId: string;
  let courseId: string;

  if (input.lessonId) {
    const ref = await assertLessonOwner(user, input.lessonId, ctx);
    const existing = await prisma.lesson.findFirst({
      where: { id: input.lessonId, tenantId: ref.tenantId },
      select: { id: true, type: true, module: { select: { courseId: true } } },
    });
    if (!existing) throw notFound("Lesson not found");
    assertKindMatchesType(input.kind, existing.type);
    lessonId = input.lessonId;
    tenantId = ref.tenantId;
    courseId = existing.module.courseId;
  } else {
    // Lesson creation fused with its first upload. The lesson row exists with
    // a null content reference ONLY while its Asset is UPLOADING/PROCESSING —
    // abandoned lessons in that state are archived+removed by the daily sweep.
    if (!input.moduleId || !input.title) {
      throw badRequest("Provide lessonId, or moduleId together with title");
    }
    const modRef = await assertModuleOwner(user, input.moduleId, ctx);
    const mod = await prisma.module.findFirst({
      where: { id: modRef.id, tenantId: modRef.tenantId },
      select: { id: true, courseId: true },
    });
    if (!mod) throw notFound("Module not found");
    const agg = await prisma.lesson.aggregate({
      where: { moduleId: mod.id },
      _max: { position: true },
    });
    const created = await prisma.lesson.create({
      data: {
        tenantId: modRef.tenantId,
        moduleId: mod.id,
        title: input.title,
        type: input.kind === "VIDEO" ? "VIDEO" : "READING",
        position: (agg._max.position ?? -1) + 1,
      },
    });
    lessonId = created.id;
    tenantId = modRef.tenantId;
    courseId = mod.courseId;
  }

  const assetId = randomUUID();
  const prefix = process.env.CLOUDINARY_FOLDER_PREFIX || "elearning";
  const publicId = [
    prefix,
    "tenants",
    tenantId,
    "courses",
    courseId,
    "lessons",
    lessonId,
    input.kind.toLowerCase() + "-" + assetId,
  ].join("/");

  const provider = getStorageProvider();
  const signed = await provider.createSignedUpload({ publicId, kind: input.kind });

  // Sanitized display-only filename: strip paths/control chars, cap length.
  const filename = input.filename
    ?.replace(/[/\\]/g, "")
    .replace(/[\u0000-\u001f<>:"|?*]/g, "")
    .trim()
    .slice(0, 160);

  const asset = await prisma.asset.create({
    data: {
      id: assetId,
      tenantId,
      lessonId,
      courseId,
      kind: input.kind,
      status: "UPLOADING",
      publicId,
      resourceType: input.kind === "VIDEO" ? "video" : "image",
      filename: filename || null,
    },
  });
  log("upload.signed", {
    tenantId,
    lessonId,
    assetId: asset.id,
    kind: input.kind,
  });
  return {
    assetId: asset.id,
    ...signed,
    resourceType: asset.resourceType as "video" | "image",
  };
}

/** VIDEO assets only attach to VIDEO lessons; PDF assets only to READING. */
function assertKindMatchesType(kind: AssetKind, type: "VIDEO" | "READING") {
  const ok = (kind === "VIDEO" && type === "VIDEO") || (kind === "PDF" && type === "READING");
  if (!ok) {
    throw conflict(
      `A ${kind === "VIDEO" ? "video" : "PDF"} asset cannot be attached to this lesson type`,
    );
  }
}

// ---------------------------------------------------------------------------
// Completion (idempotent)
// ---------------------------------------------------------------------------

/**
 * Finalizes an upload. Idempotent: repeated calls return the current state.
 * A client can NEVER mark an asset READY directly — readiness requires the
 * provider to confirm the object's existence, format and size.
 */
export async function completeUpload(ctx: TenantContext, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, tenantId: ctx.tenant.id },
  });
  if (!asset) throw notFound("Upload not found");

  // Idempotent completion (duplicate requests are safe).
  if (asset.status === "READY" || asset.status === "PROCESSING") {
    log("upload.complete_duplicate", { tenantId: asset.tenantId, assetId: asset.id, status: asset.status });
    return { assetId: asset.id, status: asset.status };
  }
  if (asset.status === "FAILED") {
    throw conflict("This upload failed. Start a new upload.");
  }

  const provider = getStorageProvider();
  let meta;
  try {
    meta = await provider.getObjectMetadata(asset.publicId, asset.kind);
  } catch (err) {
    await markFailed(asset.id, "provider_unreachable");
    throw err;
  }

  // The provider must confirm the object exists — a client claiming 100%
  // proves nothing (spec §11).
  if (!meta) {
    await markFailed(asset.id, "missing_object");
    throw badRequest("Upload verification failed: the file did not reach storage");
  }

  try {
    assertFormatAllowed(asset.kind, meta.format);
    assertSizeAllowed(asset.kind, meta.bytes);
  } catch (err) {
    await markFailed(asset.id, "policy_rejected");
    throw err;
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      bytes: meta.bytes,
      format: meta.format,
      duration: meta.durationSeconds,
      status: asset.kind === "VIDEO" ? "PROCESSING" : "READY",
    },
  });
  log("upload.completed", {
    tenantId: asset.tenantId,
    lessonId: asset.lessonId ?? undefined,
    assetId: asset.id,
    kind: asset.kind,
    bytes: meta.bytes,
    status: asset.kind === "VIDEO" ? "PROCESSING" : "READY",
  });

  await linkAssetToLesson(asset.id, asset.publicId, asset.kind, asset.lessonId, meta.durationSeconds);

  if (asset.kind === "VIDEO") {
    // Videos go through PROCESSING until the worker verifies provider-side
    // readiness. With QStash disabled (dev), verify inline.
    const publisher = createMediaPublisher();
    if (publisher.constructor.name === "NoopMediaPublisher") {
      await verifyAssetReady(asset.id);
    } else {
      await publisher.publish({ type: "verify", assetId: asset.id });
    }
  }

  const fresh = await prisma.asset.findUniqueOrThrow({
    where: { id: asset.id },
    select: { status: true },
  });
  return { assetId: asset.id, status: fresh.status };
}

/**
 * Links a verified asset into its lesson following safe replacement ordering:
 * DB reference updated first, old files deleted asynchronously afterwards.
 */
async function linkAssetToLesson(
  assetId: string,
  publicId: string,
  kind: AssetKind,
  lessonId: string | null,
  durationSeconds: number | null,
) {
  if (!lessonId) return;
  const previousAssets = await prisma.asset.findMany({
    where: { lessonId, kind, status: { in: ["READY", "FAILED"] }, id: { not: assetId } },
    select: { publicId: true, kind: true },
  });
  const ref = cloudinaryRef(publicId);
  await prisma.lesson.update({
    where: { id: lessonId },
    data:
      kind === "VIDEO"
        ? {
            videoUrl: ref,
            article: null,
            pdfUrl: null,
            ...(durationSeconds != null ? { videoDuration: Math.round(durationSeconds) } : {}),
          }
        : { pdfUrl: ref, videoUrl: null, article: null },
  });
  // Old/replaced files are removed asynchronously AFTER the DB references the
  // new file — a failed new upload never destroys working content.
  if (previousAssets.length > 0) {
    await deleteAssetsAsync(
      previousAssets.map((a) => ({ publicId: a.publicId, kind: a.kind as AssetKind })),
    );
  }
}

async function markFailed(assetId: string, reason: string) {
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      status: "FAILED",
      metadata: { failureReason: reason },
    },
  });
  log("upload.failed", { assetId, reason });
}

// ---------------------------------------------------------------------------
// Processing lifecycle
// ---------------------------------------------------------------------------

/**
 * Worker step for VIDEO assets in PROCESSING: confirms provider-side
 * existence/readiness and flips the asset to READY (or FAILED).
 */
export async function verifyAssetReady(assetId: string): Promise<{ assetId: string; status: string }> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { assetId, status: "MISSING" };
  if (asset.status !== "PROCESSING") return { assetId, status: asset.status };

  const provider = getStorageProvider();
  const meta = await provider.getObjectMetadata(asset.publicId, "VIDEO");
  if (!meta || !assertFormatAllowedSafe("VIDEO", meta.format)) {
    await markFailed(asset.id, meta ? "processing_invalid_format" : "processing_missing_object");
    return { assetId, status: "FAILED" };
  }
  await prisma.asset.update({
    where: { id: asset.id },
    data: { status: "READY", bytes: meta.bytes, duration: meta.durationSeconds },
  });
  log("processing.completed", { tenantId: asset.tenantId, assetId: asset.id });
  return { assetId, status: "READY" };
}

function assertFormatAllowedSafe(kind: AssetKind, format: string | null): boolean {
  try {
    assertFormatAllowed(kind, format);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Student media resolution
// ---------------------------------------------------------------------------

export interface ResolvedMedia {
  kind: "video" | "pdf";
  url: string;
  /** null => legacy/public URL without expiry */
  expiresAt: Date | null;
}

/**
 * Resolves playable/viewable media for an authorized student. Private
 * (`cloudinary:`-referenced) assets require READY status and produce a
 * short-lived signed URL; legacy direct https URLs pass through unchanged.
 * Returns null when the lesson has no content of the requested kind yet.
 */
export async function resolveLessonMedia(
  ctx: TenantContext,
  courseId: string,
  lessonId: string,
  wanted: "video" | "pdf",
): Promise<ResolvedMedia | null> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId: ctx.tenant.id, module: { courseId } },
    select: { type: true, videoUrl: true, pdfUrl: true },
  });
  if (!lesson) throw notFound("Lesson not found");
  if (wanted === "video" ? lesson.type !== "VIDEO" : lesson.type !== "READING") {
    throw conflict("This lesson does not contain that kind of media");
  }
  const ref = wanted === "video" ? lesson.videoUrl : lesson.pdfUrl;
  if (!ref) return null;

  if (isCloudinaryRef(ref)) {
    const asset = await prisma.asset.findFirst({
      where: { publicId: ref.slice("cloudinary:".length), tenantId: ctx.tenant.id },
      select: { status: true, kind: true, publicId: true },
    });
    if (!asset || asset.status !== "READY") {
      throw notFound(wanted === "video" ? "Video is not ready yet" : "Document is not ready yet");
    }
    const provider = getStorageProvider();
    const ttl = wanted === "video" ? VIDEO_URL_TTL_S : PDF_URL_TTL_S;
    const signed = await provider.getSignedDeliveryUrl(
      asset.publicId,
      asset.kind as AssetKind,
      ttl,
    );
    return { kind: wanted, url: signed.url, expiresAt: signed.expiresAt };
  }

  // Legacy/direct reference (seeded external URLs). Same exposure as before
  // this feature existed; documented limitation.
  return { kind: wanted, url: ref, expiresAt: null };
}

// ---------------------------------------------------------------------------
// Cleanup / async deletion
// ---------------------------------------------------------------------------

const SWEEP_INTERVAL_S = 24 * 60 * 60;
const SWEEP_LOCK_KEY = "media:cleanup:last";
/** Dev fallback when Redis is not configured (single process only). */
let lastLocalSweep = 0;

/**
 * Traffic-triggered daily sweep (no QStash required).
 *
 * Piggybacks on upload endpoints: at most one caller per interval actually
 * runs the sweep; the Redis SET-NX lock coordinates multiple app instances.
 * With QStash enabled, the self-rescheduling worker remains the primary
 * trigger — this path is the zero-config fallback that guarantees abandoned
 * uploads are reclaimed even in setups without a scheduler.
 */
export async function runSweepIfDue(): Promise<boolean> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    let acquired = false;
    if (url && token) {
      const redis = new Redis({ url, token });
      acquired = (await redis.set(SWEEP_LOCK_KEY, Date.now(), { nx: true, ex: SWEEP_INTERVAL_S })) === "OK";
    } else if (Date.now() - lastLocalSweep > SWEEP_INTERVAL_S * 1000) {
      lastLocalSweep = Date.now();
      acquired = true;
    }
    if (!acquired) return false;
    const result = await sweepStaleAssets();
    log("cleanup.sweep", result);
    return true;
  } catch (err) {
    // Never let cleanup trouble affect the upload request it rides on.
    console.error("[media] scheduled sweep failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Fire-and-forget wrapper used by upload endpoints. */
export function scheduleSweep(): void {
  void runSweepIfDue();
}

/** Enqueues asynchronous deletion; falls back to inline best-effort in dev. */
export async function deleteAssetsAsync(targets: { publicId: string; kind: AssetKind }[]) {
  if (targets.length === 0) return;
  const publisher = createMediaPublisher();
  if (publisher.constructor.name !== "NoopMediaPublisher") {
    await publisher.publish({ type: "delete", targets });
    log("file.delete_scheduled", { count: targets.length });
    return;
  }
  const provider = getStorageProvider();
  for (const t of targets) {
    try {
      await provider.deleteObject(t.publicId, t.kind);
      log("file.deleted", { publicIdPrefix: t.publicId.slice(0, 40) });
    } catch (err) {
      logErrorSafe(t.publicId, err);
    }
  }
}

function logErrorSafe(publicId: string, err: unknown) {
  console.error("[media] file.delete_failed", publicId.slice(0, 40), err instanceof Error ? err.message : err);
}

/**
 * Sweep executed by the cleanup job:
 *  - stale UPLOADING (abandoned multipart sessions): destroy file, mark FAILED
 *  - FAILED assets past retention: destroy file + delete row
 *  - orphaned assets (lesson/course cascade-deleted): destroy file + delete row
 *
 * Cloudinary also expires incomplete multipart sessions on its side; this sweep
 * guarantees our accounting converges even when that alone isn't enough.
 */
export async function sweepStaleAssets() {
  const now = Date.now();
  const staleCutoff = new Date(now - UPLOAD_STALE_HOURS * 3600_000);
  const failedCutoff = new Date(now - FAILED_ASSET_TTL_HOURS * 3600_000);
  const orphanCutoff = new Date(now - ORPHANED_ASSET_TTL_HOURS * 3600_000);
  const provider = getStorageProvider();

  const staleUploading = await prisma.asset.findMany({
    where: { status: "UPLOADING", createdAt: { lt: staleCutoff } },
    select: { id: true, publicId: true, kind: true, tenantId: true },
  });
  for (const a of staleUploading) {
    try {
      await provider.deleteObject(a.publicId, a.kind as AssetKind);
    } catch (err) {
      logErrorSafe(a.publicId, err);
    }
    await prisma.asset.update({
      where: { id: a.id },
      data: { status: "FAILED", metadata: { failureReason: "abandoned_upload_swept" } },
    });
    log("cleanup.abandoned_upload", { tenantId: a.tenantId, assetId: a.id });
  }

  const failedDone = await prisma.asset.findMany({
    where: { status: "FAILED", updatedAt: { lt: failedCutoff } },
    select: { id: true, publicId: true, kind: true },
  });
  for (const a of failedDone) {
    try {
      await provider.deleteObject(a.publicId, a.kind as AssetKind);
    } catch (err) {
      logErrorSafe(a.publicId, err);
    }
    await prisma.asset.delete({ where: { id: a.id } }).catch(() => {});
    log("cleanup.failed_asset_removed", { assetId: a.id });
  }

  const orphans = await prisma.asset.findMany({
    where: { lessonId: null, updatedAt: { lt: orphanCutoff } },
    select: { id: true, publicId: true, kind: true },
  });
  for (const a of orphans) {
    try {
      await provider.deleteObject(a.publicId, a.kind as AssetKind);
    } catch (err) {
      logErrorSafe(a.publicId, err);
    }
    await prisma.asset.delete({ where: { id: a.id } }).catch(() => {});
    log("cleanup.orphaned_asset_removed", { assetId: a.id });
  }

  // Lessons abandoned with NO content at all (e.g. an instructor created a
  // VIDEO lesson via the upload flow but never uploaded / cancelled and
  // closed the browser). Archived then removed so incomplete lessons can
  // never linger as apparently-valid content (spec §2).
  const staleEmptyLessons = await prisma.lesson.findMany({
    where: {
      videoUrl: null,
      article: null,
      pdfUrl: null,
      updatedAt: { lt: staleCutoff },
      assets: { none: { status: { in: ["UPLOADING", "PROCESSING", "READY"] } } },
    },
    select: { id: true, tenantId: true, title: true },
    take: 200,
  });
  let abandonedLessonsRemoved = 0;
  for (const l of staleEmptyLessons) {
    const stillAssets = await prisma.asset.count({ where: { lessonId: l.id } });
    if (stillAssets > 0) continue;
    await prisma.lessonContentArchive.create({
      data: {
        tenantId: l.tenantId,
        lessonId: l.id,
        lessonTitle: l.title,
        reason: "INCOMPLETE",
      },
    });
    await prisma.lesson.delete({ where: { id: l.id } }).catch(() => {});
    abandonedLessonsRemoved += 1;
    log("cleanup.abandoned_empty_lesson", { tenantId: l.tenantId, lessonId: l.id });
  }

  return {
    abandoned: staleUploading.length,
    failedRemoved: failedDone.length,
    orphanedRemoved: orphans.length,
    abandonedLessonsRemoved,
  };
}
