/**
 * Phase E route-propagation tests: staff-console services must never leak or
 * mutate data across tenants, even for the same user id and even when the
 * caller holds valid memberships.
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { UserRole } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { listAdminCourses } from "@/server/services/admin.course.service";
import { createModule } from "@/server/services/admin.course.service";
import {
  updateQuiz,
  deleteQuiz,
} from "@/server/services/admin.content.service";
import { listEnrollments } from "@/server/services/enrollment.service";
import { listReports, resolveReport } from "@/server/services/report.service";
import {
  listCertificateRequests,
  decideCertificateRequest,
} from "@/server/services/certificate-request.service";
import { getInstructorAnalytics } from "@/server/services/stats.service";
import { getUserScores } from "@/server/services/user.service";
import {
  listCommentsByLesson,
  updateComment,
  deleteComment,
} from "@/server/services/comment.service";
import type { TenantContext } from "@/server/tenant-context";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
let tenantAId: string;
let tenantBId: string;
let instructorA: User; // member of BOTH tenants (INSTRUCTOR in A, STUDENT in B)
let studentA: User;
let courseA: string;
let courseB: string;
let quizB: string;
let reportB: string;
let certRequestB: string;
let commentB: string;

function expectStatus(status: number) {
  return (err: unknown): boolean => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    assert.strictEqual((err as ApiError).statusCode, status);
    return true;
  };
}

async function seedUser(role: UserRole): Promise<User> {
  seq += 1;
  const id = `routetenant-${Date.now()}-${seq}-${role}`;
  return prisma.user.create({
    data: {
      id,
      username: id,
      email: `${id}@example.com`,
      password: "x",
      role,
      emailVerifiedAt: new Date(),
    },
  });
}

async function membership(userId: string, tenantId: string, role: "STUDENT" | "INSTRUCTOR") {
  await prisma.tenantMembership.create({ data: { userId, tenantId, role } });
}

async function ctxFor(userId: string, tenantId: string): Promise<TenantContext> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const membershipRow = await prisma.tenantMembership.findUniqueOrThrow({
    where: { userId_tenantId: { userId, tenantId } },
    include: { tenant: true },
  });
  return { user, tenant: membershipRow.tenant, membership: membershipRow, role: membershipRow.role };
}

before(async () => {
  await provisionFreshTestDatabase();
  const stamp = Date.now();
  tenantAId = (
    await prisma.tenant.create({ data: { name: "Route A", slug: `route-a-${stamp}` } })
  ).id;
  tenantBId = (
    await prisma.tenant.create({ data: { name: "Route B", slug: `route-b-${stamp}` } })
  ).id;

  instructorA = await seedUser(UserRole.INSTRUCTOR);
  studentA = await seedUser(UserRole.STUDENT);
  // Same human, two tenants: INSTRUCTOR authority in A only.
  await membership(instructorA.id, tenantAId, "INSTRUCTOR");
  await membership(instructorA.id, tenantBId, "STUDENT");
  await membership(studentA.id, tenantAId, "STUDENT");

  courseA = (
    await prisma.course.create({
      data: { slug: `rt-a-${stamp}`, title: "RT course A", price: 0, isPublished: true, instructorId: instructorA.id, tenantId: tenantAId },
    })
  ).id;
  courseB = (
    await prisma.course.create({
      data: { slug: `rt-b-${stamp}`, title: "RT course B", price: 0, isPublished: true, instructorId: instructorA.id, tenantId: tenantBId },
    })
  ).id;

  const moduleB = await prisma.module.create({
    data: { courseId: courseB, title: "MB", position: 0, tenantId: tenantBId },
  });
  quizB = (
    await prisma.quiz.create({
      data: { moduleId: moduleB.id, title: "QB", tenantId: tenantBId, questions: [] },
    })
  ).id;

  await prisma.enrollment.create({
    data: { userId: studentA.id, courseId: courseB, tenantId: tenantBId },
  });

  reportB = (
    await prisma.report.create({
      data: { reporterId: studentA.id, courseId: courseB, tenantId: tenantBId, reason: "spam" },
    })
  ).id;

  certRequestB = (
    await prisma.certificateRequest.create({
      data: { userId: studentA.id, courseId: courseB, status: "PENDING" },
    })
  ).id;

  const moduleB2 = await prisma.module.create({
    data: { courseId: courseB, title: "MB2", position: 1, tenantId: tenantBId },
  });
  const lessonB = await prisma.lesson.create({
    data: { moduleId: moduleB2.id, title: "LB", type: "READING", position: 0, tenantId: tenantBId },
  });
  commentB = (
    await prisma.comment.create({
      data: { userId: studentA.id, lessonId: lessonB.id, content: "hello from B" },
    })
  ).id;
});

test("listAdminCourses is hard-scoped to the active tenant", async () => {
  const ctxA = await ctxFor(instructorA.id, tenantAId);
  const res = await listAdminCourses({ page: 1, pageSize: 50 }, { tenantId: tenantAId, instructorId: instructorA.id });
  const ids = res.items.map((c) => c.id);
  assert.ok(ids.includes(courseA));
  assert.ok(!ids.includes(courseB), "tenant B course must be invisible from tenant A");
});

test("listEnrollments is hard-scoped to the active tenant", async () => {
  const res = await listEnrollments({ page: 1, pageSize: 50 }, { tenantId: tenantAId, instructorId: instructorA.id });
  assert.ok(!res.items.some((i) => i.course.id === courseB));
});

test("listReports is hard-scoped to the active tenant", async () => {
  const res = await listReports({ page: 1, pageSize: 50 }, { tenantId: tenantAId, instructorId: instructorA.id });
  assert.ok(!res.items.some((r) => r.id === reportB));
});

test("resolveReport cannot touch another tenant's report", async () => {
  // TENANT MODE scoped to A: reportB lives in B -> not found.
  await assert.rejects(
    async () =>
      resolveReport(instructorA.id, reportB, "RESOLVED", { tenantId: tenantAId }),
    expectStatus(404),
  );
  // PLATFORM MODE (no scope): SUPERADMIN resolves any report.
  const resolved = await resolveReport(instructorA.id, reportB, "RESOLVED");
  assert.strictEqual(resolved.status, "RESOLVED");
});

test("quiz mutations are rejected outside the active tenant", async () => {
  const ctxA = await ctxFor(instructorA.id, tenantAId);
  await assert.rejects(
    async () => updateQuiz(quizB, { title: "hacked" }, tenantAId),
    expectStatus(404),
  );
  await assert.rejects(
    async () => deleteQuiz(quizB, tenantAId),
    expectStatus(404),
  );
  // Sanity: with the owning tenant it succeeds.
  const updated = await updateQuiz(quizB, { title: "QB-renamed" }, tenantBId);
  assert.strictEqual(updated.title, "QB-renamed");
});

test("createModule derives its tenant from the parent course row", async () => {
  const mod = await createModule({ courseId: courseB, title: "created-in-B" });
  assert.strictEqual(mod.tenantId, tenantBId);
});

test("certificate requests are listed and decided only inside the active tenant", async () => {
  const listed = await listCertificateRequests({
    tenantId: tenantAId,
    userId: instructorA.id,
  });
  assert.ok(!listed.some((r) => r.id === certRequestB));

  // TENANT MODE scoped to A: request lives in B -> not found.
  await assert.rejects(
    async () =>
      decideCertificateRequest(instructorA.id, certRequestB, "APPROVE", {
        tenantId: tenantAId,
      }),
    expectStatus(404),
  );

  // PLATFORM MODE (no scope): SUPERADMIN decides any request.
  const decided = await decideCertificateRequest(
    instructorA.id,
    certRequestB,
    "REJECT",
  );
  assert.strictEqual(decided.request.status, "REJECTED");
});

test("instructor analytics never span tenants", async () => {
  const analyticsA = await getInstructorAnalytics(instructorA.id, tenantAId);
  assert.deepStrictEqual(analyticsA.courses.map((c) => c.id), [courseA]);
  const analyticsB = await getInstructorAnalytics(instructorA.id, tenantBId);
  assert.deepStrictEqual(analyticsB.courses.map((c) => c.id), [courseB]);
});

test("user scores never span tenants", async () => {
  const scoresA = await getUserScores(studentA.id, tenantAId);
  assert.deepStrictEqual(scoresA.quizResults, []);
  assert.deepStrictEqual(scoresA.testResults, []);
});

test("comments are invisible and immutable across tenants", async () => {
  const outsider = await ctxFor(studentA.id, tenantAId);
  const listed = await listCommentsByLesson(
    (await prisma.comment.findUniqueOrThrow({ where: { id: commentB } })).lessonId,
    outsider,
  );
  assert.deepStrictEqual(listed, []);

  await assert.rejects(
    async () => updateComment(outsider, commentB, "tampered"),
    expectStatus(404),
  );
  await assert.rejects(
    async () => deleteComment(outsider, commentB),
    expectStatus(404),
  );
});
