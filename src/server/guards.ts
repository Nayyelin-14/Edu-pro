import type { User } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth";
import { ApiError, forbidden, notFound, unauthorized } from "@/lib/errors";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import type { TenantContext } from "@/server/tenant-context";

export type { User };

/** Returns the current user or throws 401. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw unauthorized("Please sign in");
  return user;
}

/** Returns the current user or null (no throw). */
export function optionalUser(): Promise<User | null> {
  return getSessionUser();
}

/** Server-component variant: redirects to login instead of throwing 401. */
export async function requireUserRedirect(next: string): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireVerified(user: User): Promise<User> {
  if (!user.emailVerifiedAt) {
    throw new ApiError(
      403,
      "Please verify your email to continue",
      { code: "EMAIL_NOT_VERIFIED" },
    );
  }
  return user;
}

/** Requires any staff role (INSTRUCTOR or SUPERADMIN). */
export async function requireStaff(user: User): Promise<User> {
  if (
    user.role !== UserRole.INSTRUCTOR &&
    user.role !== UserRole.SUPERADMIN
  ) {
    throw forbidden("Admin access required");
  }
  return user;
}

/** Requires SUPERADMIN specifically. */
export async function requireSuperAdmin(user: User): Promise<User> {
  if (user.role !== UserRole.SUPERADMIN) {
    throw forbidden("Superadmin access required");
  }
  return user;
}

export function isStaff(user: User): boolean {
  return (
    user.role === UserRole.INSTRUCTOR ||
    user.role === UserRole.SUPERADMIN
  );
}

export function isAdminOrHigher(user: User): boolean {
  return isStaff(user);
}


// ---------------------------------------------------------------------------
// Resource ownership guards.
//
// Two modes:
//   TENANT MODE (default): the resource must exist inside the caller's active
//     tenant (cross-tenant ids resolve as "not found" — no existence leak) and
//     the caller must OWN it with at least "author" capability.
//   PLATFORM MODE (SUPERADMIN): whole-tenant administration belongs to the
//     SUPERADMIN alone; they may act on any resource in any tenant.
// ---------------------------------------------------------------------------

function notInTenant(): ApiError {
  // Identical semantics to a missing row: prevents cross-tenant probing.
  return notFound("Course not found");
}

export async function assertCourseOwner(
  user: User,
  courseId: string,
  ctx?: TenantContext,
): Promise<{ id: string; tenantId: string }> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, tenantId: true, instructorId: true },
  });
  if (!course) throw notInTenant();
  // PLATFORM MODE: SUPERADMIN administers every tenant.
  if (isPlatformAdmin(user)) {
    return { id: course.id, tenantId: course.tenantId };
  }
  // TENANT MODE: instructors manage only their own course in their own tenant.
  if (!ctx) throw forbidden("Tenant context required");
  if (course.tenantId !== ctx.tenant.id) throw notInTenant();
  requireTenantCapability(ctx, "author");
  if (course.instructorId !== user.id) {
    throw forbidden("You do not own this course");
  }
  return { id: course.id, tenantId: course.tenantId };
}

async function ownedByCourse(
  user: User,
  courseId: string | null,
  ctx?: TenantContext,
): Promise<{ id: string; tenantId: string }> {
  if (!courseId) throw notFound("Not found");
  return assertCourseOwner(user, courseId, ctx);
}

export async function assertModuleOwner(
  user: User,
  moduleId: string,
  ctx?: TenantContext,
) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) throw notFound("Module not found");
  return ownedByCourse(user, mod.courseId, ctx);
}

export async function assertLessonOwner(
  user: User,
  lessonId: string,
  ctx?: TenantContext,
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw notFound("Lesson not found");
  return ownedByCourse(user, lesson.module.courseId, ctx);
}

export async function assertQuizOwner(
  user: User,
  quizId: string,
  ctx?: TenantContext,
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { module: { select: { courseId: true } } },
  });
  if (!quiz) throw notFound("Quiz not found");
  return ownedByCourse(user, quiz.module.courseId, ctx);
}

export async function assertTestOwner(
  user: User,
  testId: string,
  ctx?: TenantContext,
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { courseId: true },
  });
  if (!test) throw notFound("Test not found");
  return ownedByCourse(user, test.courseId, ctx);
}
