/**
 * Phase D — cross-tenant attack suite (service layer).
 *
 * Every tenant-scoped operation must fail CLOSED when the caller's trusted
 * TenantContext does not cover the target resource. Negative READ / UPDATE /
 * DELETE cases are all exercised. Client-supplied tenant identifiers are
 * proven unable to override the context.
 *
 * Run with: npx tsx --test tests/integration/cross-tenant.test.ts
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import {
  enroll,
  isEnrolled,
  deleteEnrollment,
} from "@/server/services/enrollment.service";
import { toggleWishlist, listWishlist } from "@/server/services/wishlist.service";
import { createReview, updateReview } from "@/server/services/review.service";
import { submitQuiz } from "@/server/services/quiz.service";
import { startTest } from "@/server/services/test.service";
import { toggleLessonComplete } from "@/server/services/learning.service";
import { createComment } from "@/server/services/comment.service";
import { createReport } from "@/server/services/report.service";
import { requestCertificate } from "@/server/services/certificate-request.service";
import { startCheckout, confirmOrder, hasAccess } from "@/server/services/order.service";
import { getCourseForLearning } from "@/server/services/course.service";
import {
  resolveTenantContext,
  assertTenantMember,
  buildJobTenantContext,
} from "@/server/tenant-context";
import { requireTenantCapability } from "@/server/authorization";
import { fixtureTenantId, grantMembership, ctxFor } from "../helpers/tenant";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

async function denies(p: Promise<unknown>, status?: number) {
  try {
    await p;
    assert.fail("expected denial");
  } catch (e) {
    assert.ok(e instanceof ApiError, `expected ApiError, got ${String(e)}`);
    if (status) assert.strictEqual((e as ApiError).statusCode, status);
  }
}

async function makeUser(role: UserRole = UserRole.STUDENT) {
  const id = uniq("u");
  return prisma.user.create({
    data: { id, username: id, email: `${id}@x.local`, password: "x", role },
  });
}

interface CourseBundle {
  courseId: string;
  lessonId: string;
  moduleId: string;
  quizId: string;
  testId: string;
}

async function seedCourseBundle(tenantId: string): Promise<CourseBundle> {
  const course = await prisma.course.create({
    data: {
      slug: uniq("course"),
      title: `Course ${seq}`,
      price: 0,
      isPublished: true,
      tenantId,
    },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "M", position: 1, tenantId },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "L", type: "READING", position: 1, tenantId },
  });
  const quiz = await prisma.quiz.create({
    data: {
      moduleId: mod.id,
      title: "Q",
      tenantId,
      questions: [{ id: "q1", question: "2+2?", options: ["3", "4"], correctIndex: 1 }],
    },
  });
  const test = await prisma.test.create({
    data: {
      courseId: course.id,
      title: "T",
      tenantId,
      passingScore: 50,
      timeLimitMinutes: 30,
      attemptLimit: 3,
      questions: [{ id: "q1", question: "2+2?", options: ["3", "4"], correctIndex: 1 }],
    },
  });
  return { courseId: course.id, lessonId: lesson.id, moduleId: mod.id, quizId: quiz.id, testId: test.id };
}

let userA: Awaited<ReturnType<typeof makeUser>>;
let superadminNoMem: Awaited<ReturnType<typeof makeUser>>;
let superadminStud: Awaited<ReturnType<typeof makeUser>>;
let instructorStud: Awaited<ReturnType<typeof makeUser>>;
let instructorInstr: Awaited<ReturnType<typeof makeUser>>;
let ctxA: Awaited<ReturnType<typeof ctxFor>>;
let bundleA: CourseBundle;
let bundleB: CourseBundle;
let reviewBId = "";
let tenantBSlug = "";

before(async () => {
  await provisionFreshTestDatabase();
  // Tenant A = shared fixture tenant. Tenant B = a second, distinct tenant.
  const tenantAId = await fixtureTenantId();
  const tenantB = await prisma.tenant.create({
    data: { name: "Tenant B", slug: uniq("tenant-b") },
  });
  tenantBSlug = tenantB.slug;

  userA = await makeUser();
  const userB = await makeUser();
  superadminNoMem = await makeUser(UserRole.SUPERADMIN);
  superadminStud = await makeUser(UserRole.SUPERADMIN);
  instructorStud = await makeUser(UserRole.INSTRUCTOR);
  instructorInstr = await makeUser(UserRole.STUDENT);

  await grantMembership(userA.id, "STUDENT"); // tenant A
  await grantMembership(superadminStud.id, "STUDENT");
  await grantMembership(instructorStud.id, "STUDENT");
  await prisma.tenantMembership.create({
    data: { userId: userB.id, tenantId: tenantB.id, role: "STUDENT" },
  });
  await prisma.tenantMembership.create({
    data: { userId: instructorInstr.id, tenantId: tenantB.id, role: "INSTRUCTOR" },
  });

  bundleA = await seedCourseBundle(tenantAId);
  bundleB = await seedCourseBundle(tenantB.id);

  ctxA = await ctxFor(userA.id);

  // Legit rows inside tenant B owned by userB (targets of the attacks).
  await prisma.enrollment.create({
    data: { userId: userB.id, courseId: bundleB.courseId, tenantId: tenantB.id },
  });
  const reviewB = await prisma.review.create({
    data: { userId: userB.id, courseId: bundleB.courseId, tenantId: tenantB.id, rating: 5 },
  });
  reviewBId = reviewB.id;
});

// ---------------------------------------------------------------- READ
test("READ: course detail of Tenant B resolves as not-found for Tenant A context", async () => {
  await denies(getCourseForLearning(ctxA, bundleB.courseId), 404);
});

test("READ: enrollment status across tenants is false", async () => {
  assert.strictEqual(await isEnrolled(userA.id, bundleB.courseId, (await ctxFor(userA.id)).tenant.id), false);
  assert.strictEqual(await hasAccess(userA.id, bundleB.courseId, (await ctxFor(userA.id)).tenant.id), false);
});

test("READ: wishlist listing never leaks other tenants' items", async () => {
  const items = await listWishlist(ctxA);
  assert.ok(items.every((i) => i.course.id !== bundleB.courseId));
});

// ---------------------------------------------------------------- CREATE
test("CREATE: enroll into Tenant B course denied", async () => {
  await denies(enroll(ctxA, bundleB.courseId), 404);
});

test("CREATE: wishlist-toggle on Tenant B course denied", async () => {
  await denies(toggleWishlist(ctxA, bundleB.courseId), 404);
});

test("CREATE: review on Tenant B course denied", async () => {
  await denies(createReview(ctxA, { courseId: bundleB.courseId, rating: 5 }), 404);
});

test("CREATE: comment on Tenant B lesson denied", async () => {
  await denies(createComment(ctxA, { lessonId: bundleB.lessonId, content: "hi" }), 404);
});

test("CREATE: report on Tenant B course denied", async () => {
  await denies(createReport(ctxA, { courseId: bundleB.courseId, reason: "OTHER" }), 404);
});

test("CREATE: certificate request against Tenant B course denied", async () => {
  await denies(requestCertificate(ctxA, bundleB.courseId), 404);
});

test("CREATE: checkout for Tenant B course denied", async () => {
  await denies(startCheckout(ctxA, bundleB.courseId), 404);
  await denies(confirmOrder(ctxA, bundleB.courseId), 404);
});

// ------------------------------------------------- QUIZ / TEST / PROGRESS
test("QUIZ/TEST: submitting against Tenant B resources denied", async () => {
  await denies(submitQuiz(ctxA, bundleB.quizId, [{ questionId: "q1", selected: 1 }]), 404);
  await denies(startTest(ctxA, bundleB.testId), 404);
  await denies(toggleLessonComplete(ctxA, bundleB.lessonId), 404);
});

// ------------------------------------------------------------ UPDATE / DELETE
test("UPDATE: editing another tenant's review fails closed (not-found)", async () => {
  await denies(updateReview(ctxA, reviewBId, { rating: 1 }), 404);
});

test("DELETE: enrollment removal with wrong tenant fails closed", async () => {
  // Staff path derives tenant from the COURSE; passing Tenant A's id for a
  // Tenant B enrollment must not find (and therefore not delete) anything.
  const tenantAId = await fixtureTenantId();
  await denies(deleteEnrollment((await prisma.user.findUniqueOrThrow({ where: { id: (await prisma.enrollment.findFirstOrThrow({ where: { courseId: bundleB.courseId } })).userId } })).id, bundleB.courseId, tenantAId), 404);
});

test("DELETE: completed-lesson toggle cannot un-complete Tenant B lessons", async () => {
  await denies(toggleLessonComplete(ctxA, bundleB.lessonId), 404);
});

// --------------------------------------------- ROADMAP (user+tenant scoped)
test("ROADMAP: reads/writes are tenant-scoped", async () => {
  const userBRow = await prisma.user.findFirstOrThrow({
    where: { tenantMemberships: { some: { tenant: { slug: tenantBSlug } } } },
  });
  const rm = await prisma.roadmap.create({
    data: {
      userId: userBRow.id,
      tenantId: (await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantBSlug } })).id,
      title: "B roadmap",
      goal: "g",
      level: "BEGINNER",
      durationWeeks: 4,
      hoursPerWeek: 5,
      saved: false,
    },
  });
  const { roadmapReadRepo } = await import("@/server/services/roadmap.read.service");
  const tenantAId = await fixtureTenantId();
  assert.equal(await roadmapReadRepo.getMyRoadmap(userBRow.id, rm.id, tenantAId), null);
  await roadmapReadRepo.saveMyRoadmap(userBRow.id, rm.id, tenantAId);
  assert.equal((await prisma.roadmap.findUniqueOrThrow({ where: { id: rm.id } })).saved, false);
});

// ------------------------------------------ CLIENT-SUPPLIED IDS CANNOT AUTHORIZE
test("client-supplied tenant ids cannot override the trusted context", async () => {
  await denies(resolveTenantContext(ctxA.user, tenantBSlug)); // hint to B: not a member
  await denies(assertTenantMember(ctxA.user, (await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantBSlug } })).id));
  // Even a job payload carrying B's tenantId fails closed for a non-member:
  await denies(buildJobTenantContext(ctxA.user.id, (await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantBSlug } })).id));
});

// ------------------------------------------------------- SUPERADMIN POLICY
test("SUPERADMIN without membership cannot access tenant resources", async () => {
  await denies(resolveTenantContext(superadminNoMem, (await prisma.tenant.findUniqueOrThrow({ where: { slug: "fixture-default" } })).slug));
});

test("SUPERADMIN WITH membership is restricted by membership role in TENANT MODE", async () => {
  const ctx = await resolveTenantContext(superadminStud, "fixture-default");
  await denies(Promise.resolve().then(() => requireTenantCapability(ctx, "author")));
});

test("platform INSTRUCTOR with STUDENT membership cannot author in TENANT MODE", async () => {
  const ctx = await resolveTenantContext(instructorStud, "fixture-default");
  await denies(Promise.resolve().then(() => requireTenantCapability(ctx, "author")));
});

test("tenant INSTRUCTOR authors only within their own tenant", async () => {
  const ctxB = await resolveTenantContext(instructorInstr, tenantBSlug);
  requireTenantCapability(ctxB, "author"); // allowed in B...
  // ...but B's capability grants nothing on A's resources:
  await denies(startCheckout(ctxB, bundleA.courseId), 404);
});
