/**
 * Authorization / RBAC matrix integration tests.
 *
 * Exercises the guard functions and the ownership / role scoping rules in the
 * services against real database rows:
 *   requireStaff / requireSuperAdmin / requireVerified
 *   assertCourseOwner (owner / other instructor / student / superadmin)
 *   admin.user: role changes + user deletion are superadmin-only
 *   comments, reviews: authors may mutate their own rows only
 *   notifications: scoped to the current user
 *   listEnrollments / listAdminCourses: instructors scoped to their own courses
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { UserRole } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import {
  requireStaff,
  requireSuperAdmin,
  requireVerified,
  assertCourseOwner,
} from "@/server/guards";
import { updateUser, deleteUser } from "@/server/services/admin.user.service";
import {
  createComment,
  updateComment,
  deleteComment,
} from "@/server/services/comment.service";
import { createReview, updateReview } from "@/server/services/review.service";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/server/services/notification.service";
import { listEnrollments } from "@/server/services/enrollment.service";
import { listAdminCourses } from "@/server/services/admin.course.service";
import { resolveTenantContext } from "@/server/tenant-context";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { fixtureTenantId, grantMembership, ctxFor } from "../helpers/tenant";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;

let superadmin: User;
let instructorA: User;
let instructorB: User;
let student: User;
let nonEnrolledStudent: User;
let unverified: User;
let courseA: string;
let courseB: string;
let lessonA: string;

async function seedUser(role: UserRole, opts?: { verified?: boolean }): Promise<User> {
  seq += 1;
  const id = `rbac-${Date.now()}-${seq}-${role}`;
  const user = await prisma.user.create({
    data: {
      id,
      username: id,
      email: `${id}@example.com`,
      password: "x",
      role,
      emailVerifiedAt: opts?.verified === false ? null : new Date(),
    },
  });
  if (role === UserRole.INSTRUCTOR) await grantMembership(id, "INSTRUCTOR");
  else if (role !== UserRole.SUPERADMIN) await grantMembership(id, "STUDENT");
  return user;
}

function expectStatus(status: number) {
  return (err: unknown): boolean => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    assert.strictEqual((err as ApiError).statusCode, status);
    return true;
  };
}

before(async () => {
  await provisionFreshTestDatabase();
  superadmin = await seedUser(UserRole.SUPERADMIN);
  instructorA = await seedUser(UserRole.INSTRUCTOR);
  instructorB = await seedUser(UserRole.INSTRUCTOR);
  student = await seedUser(UserRole.STUDENT);
  nonEnrolledStudent = await seedUser(UserRole.STUDENT);
  unverified = await seedUser(UserRole.STUDENT, { verified: false });

  courseA = (
    await prisma.course.create({
      data: {
        slug: `rbac-course-a-${Date.now()}`,
        title: "RBAC course A",
        price: 0,
        isPublished: true,
        instructorId: instructorA.id,
        tenantId: await fixtureTenantId(),
      },
    })
  ).id;
  courseB = (
    await prisma.course.create({
      data: {
        slug: `rbac-course-b-${Date.now()}`,
        title: "RBAC course B",
        price: 0,
        isPublished: true,
        instructorId: instructorB.id,
        tenantId: await fixtureTenantId(),
      },
    })
  ).id;
  const moduleA = await prisma.module.create({
    data: { courseId: courseA, title: "M1", position: 0, tenantId: await fixtureTenantId() },
  });
  lessonA = (
    await prisma.lesson.create({
      data: { moduleId: moduleA.id, title: "L1", type: "READING", article: "<p>hi</p>", position: 0, tenantId: await fixtureTenantId() },
    })
  ).id;
  await prisma.enrollment.create({ data: { userId: student.id, courseId: courseA, tenantId: await fixtureTenantId() } });
  await prisma.course.update({
    where: { id: courseA },
    data: { studentCount: { increment: 1 } },
  });
});

test("requireStaff: student denied, instructor and superadmin allowed", async () => {
  await assert.rejects(() => requireStaff(student), expectStatus(403));
  await requireStaff(instructorA);
  await requireStaff(superadmin);
});

test("requireSuperAdmin: instructor denied, superadmin allowed", async () => {
  await assert.rejects(() => requireSuperAdmin(instructorA), expectStatus(403));
  await requireSuperAdmin(superadmin);
});

test("requireVerified: unverified user denied, verified allowed", async () => {
  await assert.rejects(() => requireVerified(unverified), expectStatus(403));
  await requireVerified(student);
});

test("assertCourseOwner: instructors manage only their own courses in their own tenant", async () => {
  const ctxA = await ctxFor(instructorA.id);
  const ctxB = await ctxFor(instructorB.id);
  const ctxStudent = await ctxFor(student.id);

  await assertCourseOwner(instructorA, courseA, ctxA);
  await assertCourseOwner(instructorB, courseB, ctxB);
  // Not your course -> forbidden.
  await assert.rejects(
    async () => assertCourseOwner(instructorB, courseA, ctxB),
    expectStatus(403),
  );
  // Read-only membership (STUDENT) cannot author even own rows.
  await assert.rejects(
    async () => assertCourseOwner(student, courseA, ctxStudent),
    expectStatus(403),
  );
  await assert.rejects(
    async () => assertCourseOwner(instructorA, "missing", ctxA),
    expectStatus(404),
  );

  // PLATFORM MODE: SUPERADMIN manages any course in any tenant — no
  // membership or ownership needed.
  await assertCourseOwner(superadmin, courseA);
  await assertCourseOwner(superadmin, courseB);
});

test("SUPERADMIN without an active membership cannot act in tenant mode", async () => {
  // No TenantMembership rows exist for the seeded superadmin: tenant
  // resolution must fail closed even for platform admins.
  await assert.rejects(
    async () => resolveTenantContext(superadmin, null),
    expectStatus(403),
  );
  await assert.rejects(
    async () => resolveTenantContext(superadmin, "fixture-default"),
    expectStatus(403),
  );
});

test("updateUser: role changes are superadmin-only", async () => {
  // Instructor cannot change a role.
  await assert.rejects(
    () => updateUser({ id: instructorA.id, role: instructorA.role }, student.id, { role: UserRole.INSTRUCTOR }),
    expectStatus(403),
  );
  // Superadmin can.
  const updated = await updateUser(
    { id: superadmin.id, role: superadmin.role },
    student.id,
    { role: UserRole.STUDENT },
  );
  assert.strictEqual(updated.role, UserRole.STUDENT);
});

test("deleteUser: superadmin-only, and superadmins are protected", async () => {
  await assert.rejects(
    () => deleteUser({ role: instructorA.role }, student.id),
    expectStatus(403),
  );
  await assert.rejects(
    () => deleteUser({ role: superadmin.role }, superadmin.id),
    expectStatus(403),
  );
  await deleteUser({ role: superadmin.role }, nonEnrolledStudent.id);
  assert.strictEqual(await prisma.user.count({ where: { id: nonEnrolledStudent.id } }), 0);
});

test("comments: only enrolled users may create, only the author may edit/delete", async () => {
  // Self-contained fixtures: an earlier test legitimately deletes
  // nonEnrolledStudent, so this test must not depend on that row.
  const outsider = await seedUser(UserRole.STUDENT);
  await assert.rejects(
    async () => createComment(await ctxFor(outsider.id), { lessonId: lessonA, content: "hi" }),
    expectStatus(403),
  );
  const comment = await createComment(await ctxFor(student.id), { lessonId: lessonA, content: "hello" });

  const ctxStudent = await ctxFor(student.id);
  const ctxInstructorA = await ctxFor(instructorA.id);
  await assert.rejects(
    async () => updateComment(ctxInstructorA, comment.id, "tampered"),
    expectStatus(403),
  );
  await updateComment(ctxStudent, comment.id, "edited");

  await assert.rejects(
    async () => deleteComment(ctxInstructorA, comment.id),
    expectStatus(403),
  );
  await deleteComment(ctxStudent, comment.id);
});

test("reviews: only enrolled users may create, only the author may edit", async () => {
  const reviewOutsider = await seedUser(UserRole.STUDENT);
  await assert.rejects(
    async () => createReview(await ctxFor(reviewOutsider.id), { courseId: courseA, rating: 5 }),
    expectStatus(403),
  );
  const review = await createReview(await ctxFor(student.id), { courseId: courseA, rating: 4 });

  await assert.rejects(
    async () => updateReview(await ctxFor(instructorA.id), review.id, { rating: 1 }),
    // Tenant-scoped lookup: another user's review resolves as "not found".
    expectStatus(404),
  );
  await updateReview(await ctxFor(student.id), review.id, { rating: 5 });
});

test("notifications: read updates are scoped to the owner", async () => {
  await prisma.notification.create({
    data: { userId: student.id, type: "COURSE_ENROLLED", title: "t", read: false },
  });
  const other = await prisma.notification.create({
    data: { userId: instructorA.id, type: "COURSE_APPROVED", title: "t", read: false },
  });

  await assert.rejects(
    () => markNotificationRead(student.id, other.id, true),
    expectStatus(404),
  );
  const studentNote = await prisma.notification.findFirstOrThrow({
    where: { userId: student.id },
    orderBy: { createdAt: "desc" },
  });
  await markNotificationRead(student.id, studentNote.id, true);

  await markAllNotificationsRead(student.id);
  assert.strictEqual(
    await prisma.notification.count({ where: { userId: instructorA.id, read: false } }),
    1,
  );
});

test("listEnrollments: instructors only see their own courses' students", async () => {
  const res = await listEnrollments(
    { page: 1, pageSize: 50 },
    { tenantId: await fixtureTenantId(), instructorId: instructorA.id },
  );
  const rows = res.items.filter((i) => i.course.id === courseB);
  assert.deepStrictEqual(rows, []);
  assert.ok(res.items.some((i) => i.course.id === courseA));
});

test("listAdminCourses: instructors only see their own courses", async () => {
  const res = await listAdminCourses(
    { search: "RBAC", page: 1, pageSize: 50 },
    { tenantId: await fixtureTenantId(), instructorId: instructorA.id },
  );
  const ids = res.items.map((c) => c.id);
  assert.ok(ids.includes(courseA));
  assert.ok(!ids.includes(courseB));
});