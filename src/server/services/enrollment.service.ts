import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

export async function enroll(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return { alreadyEnrolled: true };

  await prisma.$transaction([
    prisma.enrollment.create({ data: { userId, courseId } }),
    prisma.course.update({
      where: { id: courseId },
      data: { studentCount: { increment: 1 } },
    }),
  ]);
  return { alreadyEnrolled: false };
}

export async function isEnrolled(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const row = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return row !== null;
}

export async function getEnrollmentStatus(userId: string, courseId: string) {
  const enrolled = await isEnrolled(userId, courseId);
  return { enrolled };
}

export async function getUserEnrollments(userId: string) {
  const rows = await prisma.enrollment.findMany({
    where: { userId },
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
    where: { userId },
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

export async function listEnrollments(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: "all" | "active" | "completed" | "dropped";
}) {
  const where: Prisma.EnrollmentWhereInput = input.search
    ? {
        OR: [
          { user: { username: { contains: input.search, mode: "insensitive" } } },
          { course: { title: { contains: input.search, mode: "insensitive" } } },
        ],
      }
    : {};
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
export async function deleteEnrollment(userId: string, courseId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!existing) throw notFound("Enrollment not found");
  await prisma.$transaction([
    prisma.enrollment.delete({
      where: { userId_courseId: { userId, courseId } },
    }),
    prisma.course.update({
      where: { id: courseId },
      data: { studentCount: { decrement: 1 } },
    }),
    prisma.completedLesson.deleteMany({ where: { userId, lesson: { module: { courseId } } } }),
  ]);
  return { success: true };
}
