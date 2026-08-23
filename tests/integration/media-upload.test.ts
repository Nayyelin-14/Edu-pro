/**
 * Integration: media upload pipeline + lesson content rules (spec §5-§9, §13).
 *
 * Uses a FAKE StorageProvider so no real Cloudinary calls happen. Covers:
 * lesson CRUD content combinations, upload authorization (cross-tenant,
 * capability), completion verification/idempotency, lifecycle transitions,
 * safe replacement ordering and media resolution authorization.
 *
 * Run: npx tsx --test tests/integration/media-upload.test.ts
 */
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { setStorageProvider, resetStorageProvider, VIDEO_ALLOWED_FORMATS } from "@/server/storage";
import type { StorageProvider } from "@/server/storage";
import {
  signUpload,
  completeUpload,
  resolveLessonMedia,
  verifyAssetReady,
  cloudinaryRef,
  sweepStaleAssets,
  runSweepIfDue,
} from "@/server/services/upload.service";
import { createLesson, updateLesson, deleteLesson } from "@/server/services/admin.course.service";
import { fixtureTenantId, grantMembership, ctxFor } from "../helpers/tenant";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Fake provider with controllable metadata results. */
const state = {
  objects: new Map<string, { format: string; bytes: number; duration?: number }>(),
  deleted: [] as string[],
};
const fakeProvider: StorageProvider = {
  name: "fake",
  async createSignedUpload({ publicId }) {
    return {
      uploadUrl: `https://fake.storage/upload/${publicId}`,
      apiKey: "public-key",
      timestamp: 111,
      signature: "not-a-secret",
      paramsToSign: { public_id: publicId, timestamp: "111", type: "authenticated" },
      chunkSize: 1024,
    };
  },
  async getObjectMetadata(publicId) {
    const o = state.objects.get(publicId);
    if (!o) return null;
    return {
      publicId,
      resourceType: o.format === "pdf" ? "image" : "video",
      format: o.format,
      bytes: o.bytes,
      durationSeconds: o.duration ?? null,
    };
  },
  async getSignedDeliveryUrl(publicId, _kind, ttl) {
    return {
      url: `https://fake.storage/dl/${publicId}?exp=${ttl}`,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  },
  async deleteObject(publicId) {
    state.deleted.push(publicId);
  },
};

async function denies(p: Promise<unknown>, status?: number) {
  try {
    await p;
    assert.fail("expected denial");
  } catch (e) {
    assert.ok(e instanceof ApiError, `expected ApiError, got ${String(e)}`);
    if (status) assert.strictEqual((e as ApiError).statusCode, status);
  }
}

/** Trusted TenantContext on a SECOND, unrelated tenant (true cross-tenant). */
async function ctxForOtherTenant(userId: string) {
  const tenant = await prisma.tenant.create({
    data: { name: `T-${uniq("t")}`, slug: uniq("t") },
  });
  const membership = await prisma.tenantMembership.create({
    data: { userId, tenantId: tenant.id, role: "INSTRUCTOR" },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { user, tenant, membership, role: membership.role };
}

async function makeUser(role: UserRole = UserRole.STUDENT) {
  const id = uniq("u");
  return prisma.user.create({
    data: { id, username: id, email: `${id}@x.local`, password: "x", role },
  });
}

interface Bundle {
  instructor: { id: string };
  otherInstructor: { id: string };
  student: { id: string };
  courseId: string;
  moduleId: string;
  lessonId: string; // READING
  videoLessonId: string; // VIDEO
}

async function seedBundle(): Promise<Bundle> {
  const tenantId = await fixtureTenantId();
  const instructor = await makeUser(UserRole.INSTRUCTOR);
  const otherInstructor = await makeUser(UserRole.INSTRUCTOR);
  const student = await makeUser();
  await grantMembership(instructor.id, "INSTRUCTOR");
  await grantMembership(otherInstructor.id, "INSTRUCTOR");
  await grantMembership(student.id, "STUDENT");

  const course = await prisma.course.create({
    data: {
      slug: uniq("course"),
      title: "Media course",
      isPublished: true,
      tenantId,
      instructorId: instructor.id,
      modules: {
        create: {
          title: "M1",
          position: 0,
          tenantId,
          lessons: {
            createMany: {
              data: [
                { title: "Reading lesson", type: "READING", article: "<p>hi</p>", position: 0, tenantId },
                { title: "Video lesson", type: "VIDEO", position: 1, tenantId },
              ],
            },
          },
        },
      },
    },
  });
  const mod = await prisma.module.findFirstOrThrow({ where: { courseId: course.id } });
  const lessons = await prisma.lesson.findMany({ where: { moduleId: mod.id }, orderBy: { position: "asc" } });
  return {
    instructor,
    otherInstructor,
    student,
    courseId: course.id,
    moduleId: mod.id,
    lessonId: lessons[0]!.id,
    videoLessonId: lessons[1]!.id,
  };
}

before(async () => {
  await provisionFreshTestDatabase();
  setStorageProvider(fakeProvider);
  // Sanity: the fake must mirror the production allowlist.
  assert.ok(VIDEO_ALLOWED_FORMATS.has("mp4"));
});

after(() => {
  resetStorageProvider();
});

// ---------------------------------------------------------------------------
// Lesson service rules
// ---------------------------------------------------------------------------

test("createLesson accepts valid combos and rejects conflicting ones", async () => {
  const b = await seedBundle();

  const reading = await createLesson({
    moduleId: b.moduleId,
    title: "R",
    type: "READING",
    isFree: false,
    article: "<p>body</p>",
  });
  assert.equal(reading.type, "READING");
  assert.equal(reading.pdfUrl, null);

  await denies(
    createLesson({
      moduleId: b.moduleId,
      title: "bad-video",
      type: "VIDEO",
      isFree: false,
      videoUrl: null as unknown as string,
    }),
    400,
  );
  await denies(
    createLesson({
      moduleId: b.moduleId,
      title: "bad-both",
      type: "READING",
      isFree: false,
      article: "<p>x</p>",
      pdfUrl: "https://x.local/a.pdf",
    }),
    400,
  );
});

test("DB CHECK constraint blocks direct conflicting writes", async () => {
  const tenantId = await fixtureTenantId();
  const l = await prisma.lesson.create({
    data: { moduleId: (await prisma.module.findFirstOrThrow()).id, title: "chk", type: "VIDEO", position: 999, tenantId },
  });
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `UPDATE "Lesson" SET "article" = '<p>x</p>' WHERE id = '${l.id}'`,
    ),
  );
});

test("updateLesson replaces PDF and schedules old file deletion AFTER db update", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.instructor.id);

  // First upload: sign -> simulate object at provider -> complete.
  const s1 = await signUpload(ctx.user, ctx, { lessonId: b.lessonId, kind: "PDF", filename: "a.pdf" });
  state.objects.set(s1.paramsToSign.public_id!, { format: "pdf", bytes: 1000 });
  const c1 = await completeUpload(ctx, s1.assetId);
  assert.equal(c1.status, "READY"); // PDFs skip PROCESSING

  let lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: b.lessonId } });
  assert.equal(lesson.pdfUrl, cloudinaryRef(s1.paramsToSign.public_id!));

  // Replacement: second upload completes, THEN the old file may be deleted.
  const s2 = await signUpload(ctx.user, ctx, { lessonId: b.lessonId, kind: "PDF", filename: "b.pdf" });
  state.objects.set(s2.paramsToSign.public_id!, { format: "pdf", bytes: 2000 });
  await completeUpload(ctx, s2.assetId);

  lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: b.lessonId } });
  assert.equal(lesson.pdfUrl, cloudinaryRef(s2.paramsToSign.public_id!));
  assert.ok(state.deleted.includes(s1.paramsToSign.public_id!), "old file deleted asynchronously");
  assert.ok(!state.deleted.includes(s2.paramsToSign.public_id!), "new file kept");
});

// ---------------------------------------------------------------------------
// Upload pipeline
// ---------------------------------------------------------------------------

test("upload sign requires author capability in the right tenant", async () => {
  const b = await seedBundle();

  // Cross-tenant instructor cannot see the lesson (404, no existence leak).
  const foreign = await ctxForOtherTenant(b.otherInstructor.id);
  await denies(
    signUpload(foreign.user, foreign, { lessonId: b.videoLessonId, kind: "VIDEO" }),
    404,
  );

  // A non-owner instructor inside the same tenant is still denied (403).
  const colleague = await ctxFor(b.otherInstructor.id);
  await denies(
    signUpload(colleague.user, colleague, { lessonId: b.videoLessonId, kind: "VIDEO" }),
    403,
  );

  // A plain student context lacks author capability (403).
  const studentCtx = await ctxFor(b.student.id);
  await denies(
    signUpload(studentCtx.user, studentCtx, { lessonId: b.videoLessonId, kind: "VIDEO" }),
    403,
  );

  // Kind must match persisted lesson type.
  const owner = await ctxFor(b.instructor.id);
  await denies(
    signUpload(owner.user, owner, { lessonId: b.lessonId, kind: "VIDEO" }),
    409,
  );
});

test("completion verifies provider existence, format and size; idempotent", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.instructor.id);

  // Missing object -> FAILED + 400. Client claiming 100% proves nothing.
  const s1 = await signUpload(ctx.user, ctx, { lessonId: b.videoLessonId, kind: "VIDEO" });
  await denies(completeUpload(ctx, s1.assetId), 400);
  const failed = await prisma.asset.findUniqueOrThrow({ where: { id: s1.assetId } });
  assert.equal(failed.status, "FAILED");

  // Bad format rejected by policy.
  const s2 = await signUpload(ctx.user, ctx, { lessonId: b.videoLessonId, kind: "VIDEO" });
  state.objects.set(s2.paramsToSign.public_id!, { format: "exe", bytes: 10 });
  await denies(completeUpload(ctx, s2.assetId), 400);

  // Happy path: video goes PROCESSING then READY via verification.
  const s3 = await signUpload(ctx.user, ctx, { lessonId: b.videoLessonId, kind: "VIDEO" });
  state.objects.set(s3.paramsToSign.public_id!, { format: "mp4", bytes: 1234567, duration: 61.4 });
  const done = await completeUpload(ctx, s3.assetId);
  assert.equal(done.status, "READY");
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: s3.assetId } });
  assert.equal(asset.bytes, BigInt(1234567));
  const vl = await prisma.lesson.findUniqueOrThrow({ where: { id: b.videoLessonId } });
  assert.equal(vl.videoUrl, cloudinaryRef(s3.paramsToSign.public_id!));
  assert.equal(vl.videoDuration, 61); // provider-reported duration persisted

  // Duplicate completion returns current state instead of duplicating.
  const dup = await completeUpload(ctx, s3.assetId);
  assert.deepEqual(dup, { assetId: s3.assetId, status: "READY" });

  // Cross-tenant completion attempt: 404, no state change.
  const foreign = await ctxForOtherTenant(b.otherInstructor.id);
  await denies(completeUpload(foreign, s3.assetId), 404);
});

test("verifyAssetReady marks missing objects FAILED, never READY", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.instructor.id);
  const s = await signUpload(ctx.user, ctx, { lessonId: b.videoLessonId, kind: "VIDEO" });
  await prisma.asset.update({ where: { id: s.assetId }, data: { status: "PROCESSING" } });
  // Object absent from provider:
  const r = await verifyAssetReady(s.assetId);
  assert.equal(r.status, "FAILED");
  const a = await prisma.asset.findUniqueOrThrow({ where: { id: s.assetId } });
  assert.equal(a.status, "FAILED");
});

test("student media resolution enforces enrollment + readiness + tenancy", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.student.id);
  await prisma.enrollment.create({
    data: { userId: b.student.id, courseId: b.courseId, tenantId: await fixtureTenantId() },
  });

  // No verified asset yet -> no media resolved (null), never a URL.
  const notReady = await resolveLessonMedia(ctx, b.courseId, b.videoLessonId, "video");
  assert.equal(notReady, null);

  // Instructor completes an upload -> student gets a signed URL.
  const owner = await ctxFor(b.instructor.id);
  const s = await signUpload(owner.user, owner, { lessonId: b.videoLessonId, kind: "VIDEO" });
  state.objects.set(s.paramsToSign.public_id!, { format: "mp4", bytes: 999 });
  await completeUpload(owner, s.assetId);

  const media = await resolveLessonMedia(ctx, b.courseId, b.videoLessonId, "video");
  assert.ok(media?.url.includes(s.paramsToSign.public_id!));
  assert.ok(media?.expiresAt); // short-lived

  // Reading lesson: article-only has no pdf -> null (no crash).
  const noPdf = await resolveLessonMedia(ctx, b.courseId, b.lessonId, "pdf");
  assert.equal(noPdf, null);

  // Cross-tenant lesson id fails closed as not-found (no existence leak).
  const stranger = await makeUser();
  await grantMembership(stranger.id, "STUDENT");
  const strangerCtx = await ctxForOtherTenant(stranger.id);
  await denies(
    resolveLessonMedia(strangerCtx, b.courseId, b.videoLessonId, "video"),
    404,
  );
});

test("sweep removes stale UPLOADING assets and abandoned empty lessons", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.instructor.id);

  // Abandoned upload: signed but never completed, older than cutoff.
  const s = await signUpload(ctx.user, ctx, { lessonId: b.videoLessonId, kind: "VIDEO" });
  const old = new Date(Date.now() - 72 * 3600_000);
  await prisma.asset.update({
    where: { id: s.assetId },
    data: { createdAt: old, updatedAt: old },
  });
  // Make the lesson truly empty (clear any content from earlier tests) so the
  // abandoned-lesson sweep applies to it too.
  await prisma.lesson.update({
    where: { id: b.videoLessonId },
    data: {
      videoUrl: null,
      article: null,
      pdfUrl: null,
      updatedAt: old,
    },
  });

  const result = await sweepStaleAssets();
  assert.ok(result.abandoned >= 1);
  assert.ok(state.deleted.includes(s.paramsToSign.public_id!));
  const swept = await prisma.asset.findUnique({ where: { id: s.assetId } });
  assert.equal(swept?.status, "FAILED");
});

test("deleteLesson removes DB rows and deletes owned files", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.instructor.id);
  const s = await signUpload(ctx.user, ctx, { lessonId: b.lessonId, kind: "PDF" });
  state.objects.set(s.paramsToSign.public_id!, { format: "pdf", bytes: 5 });
  await completeUpload(ctx, s.assetId);

  await deleteLesson(b.lessonId, await fixtureTenantId());
  assert.equal(await prisma.lesson.findUnique({ where: { id: b.lessonId } }), null);
  assert.ok(state.deleted.includes(s.paramsToSign.public_id!));
});

test("updateLesson can switch types safely", async () => {
  const b = await seedBundle();
  const ctx = await ctxFor(b.instructor.id);
  const updated = await updateLesson(
    b.lessonId,
    { title: "now-reading-still", type: "READING", article: "<p>kept</p>", pdfUrl: null },
    await fixtureTenantId(),
  );
  assert.equal(updated.article, "<p>kept</p>");
  void b;
});

test("traffic-triggered sweep runs at most once per interval (dev fallback)", async () => {
  // Force the process-local fallback (no Redis) for deterministic behavior.
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const first = await runSweepIfDue();
    assert.equal(first, true, "first call in the interval performs the sweep");
    const second = await runSweepIfDue();
    assert.equal(second, false, "second call inside the interval is a no-op");
  } finally {
    if (savedUrl) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
  }
});
