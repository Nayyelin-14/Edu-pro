import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";

/**
 * Atomically creates an enrollment (guarded by the unique userId_courseId
 * constraint) and bumps the course student count in the same transaction.
 * Safe to run concurrently: duplicate attempts are skipped, never crash.
 */
export async function enrollInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
  tenantId: string,
): Promise<{ created: boolean }> {
  const result = await tx.enrollment.createMany({
    data: [{ userId, courseId, tenantId }],
    skipDuplicates: true,
  });
  if (result.count > 0) {
    await tx.course.update({
      where: { id: courseId },
      data: { studentCount: { increment: 1 } },
    });
  }
  return { created: result.count > 0 };
}

/** Creates an enrollment in its own transaction. Returns whether it was new. */
export async function createEnrollment(
  userId: string,
  courseId: string,
  tenantId: string,
): Promise<{ created: boolean }> {
  return prisma.$transaction((tx) => enrollInTransaction(tx, userId, courseId, tenantId), {
    // Generous window: concurrent interactive transactions queue on the pooled
    // connection; the default 2s maxWait fails 100-way races with P2028.
    maxWait: 20_000,
    timeout: 30_000,
  });
}

export async function enroll(ctx: TenantContext, courseId: string) {
  const userId = ctx.user.id;
  // Tenant-scoped lookup: a cross-tenant course id resolves as "not found".
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    select: { id: true, isPublished: true, price: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  // Paid courses require a completed (PAID) order before enrollment.
  if (course.price > 0) {
    const paid = await prisma.order.findFirst({
      where: { userId, courseId, status: "PAID" },
      select: { id: true },
    });
    if (!paid) {
      throw badRequest("This course requires payment. Please complete checkout first.");
    }
  }

  const { created } = await createEnrollment(userId, courseId, ctx.tenant.id);
  return { alreadyEnrolled: !created };
}

/**
 * TENANT-AWARE enrollment check. `tenantId` MUST come from a trusted
 * TenantContext (or the tenant of the resource being acted on).
 */
export async function isEnrolled(
  userId: string,
  courseId: string,
  tenantId: string,
): Promise<boolean> {
  const row = await prisma.enrollment.findFirst({
    where: { userId, courseId, tenantId },
    select: { id: true },
  });
  return row !== null;
}

export async function getEnrollmentStatus(ctx: TenantContext, courseId: string) {
  const enrolled = await isEnrolled(ctx.user.id, courseId, ctx.tenant.id);
  return { enrolled };
}

/** Progress for a single enrollment, or null if the user is not enrolled. */
export async function getEnrollmentProgress(ctx: TenantContext, courseId: string) {
  const userId = ctx.user.id;
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId, tenantId: ctx.tenant.id },
    select: {
      course: {
        select: {
          modules: {
            select: { lessons: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!enrollment) return null;

  const completedRows = await prisma.completedLesson.findMany({
    where: { userId, lesson: { module: { courseId } } },
    select: { lessonId: true },
  });
  const completedSet = new Set(completedRows.map((c) => c.lessonId));
  const lessons = enrollment.course.modules.flatMap((m) => m.lessons);
  const completedLessons = lessons.filter((l) => completedSet.has(l.id)).length;
  const totalLessons = lessons.length;
  return {
    completedLessons,
    totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
  };
}

export async function getUserEnrollments(ctx: TenantContext) {
  const rows = await prisma.enrollment.findMany({
    where: { userId: ctx.user.id, tenantId: ctx.tenant.id },
    include: {
      course: {
        include: {
          category: { select: { id: true, name: true } },
          modules: {
            select: {
              lessons: { select: { id: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const completedRows = await prisma.completedLesson.findMany({
    where: { userId: ctx.user.id, tenantId: ctx.tenant.id },
    select: { lessonId: true },
  });
  const completedSet = new Set(completedRows.map((c) => c.lessonId));

  return rows.map((row) => {
    const totalLessons = row.course.modules.reduce(
      (acc, m) => acc + m.lessons.length,
      0,
    );
    const completedLessons = row.course.modules
      .flatMap((m) => m.lessons)
      .filter((l) => completedSet.has(l.id)).length;
    const percent =
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    return {
      enrolledAt: row.createdAt,
      course: {
        id: row.course.id,
        slug: row.course.slug,
        title: row.course.title,
        coverImage: row.course.coverImage,
        price: row.course.price,
        category: row.course.category,
      },
      progress: { completedLessons, totalLessons, percent },
    };
  });
}

export async function listEnrollments(
  input: {
    page: number;
    pageSize: number;
    search?: string;
    status?: "all" | "active" | "completed" | "dropped";
  },
  scope: {
    /** TENANT MODE: both fields set. PLATFORM MODE (SUPERADMIN): omit both. */
    tenantId?: string;
    instructorId?: string;
  },
) {
  const where: Prisma.EnrollmentWhereInput = {
    // TENANT MODE: the active tenant is a hard filter.
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(input.search
      ? {
          OR: [
            { user: { username: { contains: input.search, mode: "insensitive" } } },
            { course: { title: { contains: input.search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(scope.instructorId ? { course: { instructorId: scope.instructorId } } : {}),
  };
  const [items, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, email: true } },
        course: { 
          select: { 
            id: true, 
            title: true, 
            slug: true, 
            category: { select: { id: true, name: true } },
            modules: { 
              select: { 
                lessons: { select: { id: true } } 
              } 
            }
          } 
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.enrollment.count({ where }),
  ]);

  // Get completed lessons for all enrollments to calculate progress
  const userIds = items.map((i) => i.user.id);
  
  const completedRows = await prisma.completedLesson.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, lessonId: true },
  });

  const completedByUser = new Map<string, Set<string>>();
  for (const c of completedRows) {
    if (!completedByUser.has(c.userId)) completedByUser.set(c.userId, new Set());
    completedByUser.get(c.userId)!.add(c.lessonId);
  }

  let resultItems = items.map((row) => {
    const totalLessons = row.course.modules?.reduce(
      (acc, m) => acc + (m.lessons?.length ?? 0),
      0,
    ) ?? 0;
    const completedLessons = row.course.modules?.flatMap((m) => m.lessons ?? []).filter((l) => completedByUser.get(row.user.id)?.has(l.id)).length ?? 0;
    const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    return {
      id: row.id,
      createdAt: row.createdAt,
      user: { id: row.user.id, username: row.user.username, email: row.user.email },
      course: { id: row.course.id, title: row.course.title, slug: row.course.slug, category: row.course.category },
      progress: { completedLessons, totalLessons, percent },
    };
  });

  // Filter by status if specified
  if (input.status && input.status !== "all") {
    if (input.status === "completed") {
      resultItems = resultItems.filter((e) => e.progress.percent === 100 && e.progress.totalLessons > 0);
    } else if (input.status === "active") {
      resultItems = resultItems.filter((e) => e.progress.percent > 0 && e.progress.percent < 100);
    } else if (input.status === "dropped") {
      resultItems = resultItems.filter((e) => e.progress.percent === 0);
    }
  }

  return {
    items: resultItems,
    total: totalCount,
    page: input.page,
    pageSize: input.pageSize,
  };
}
/**
 * Staff-side enrollment removal. `tenantId` MUST come from the trusted course
 * row (see assertCourseOwner) or a TenantContext — never client input.
 */
export async function deleteEnrollment(userId: string, courseId: string, tenantId: string) {
  const existing = await prisma.enrollment.findFirst({
    where: { userId, courseId, tenantId },
  });
  if (!existing) throw notFound("Enrollment not found");
  await prisma.$transaction([
    prisma.enrollment.delete({
      where: { userId_courseId_tenantId: { userId, courseId, tenantId } },
    }),
    prisma.course.update({
      where: { id: courseId },
      data: { studentCount: { decrement: 1 } },
    }),
    prisma.completedLesson.deleteMany({ where: { userId, lesson: { module: { courseId } } } }),
  ]);
  return { success: true };
}
