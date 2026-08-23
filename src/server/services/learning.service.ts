import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";
import { isEnrolled } from "./enrollment.service";

export async function toggleLessonComplete(ctx: TenantContext, lessonId: string) {
  const userId = ctx.user.id;
  // Tenant-scoped lesson lookup prevents completing lessons of other tenants.
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId: ctx.tenant.id },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw notFound("Lesson not found");

  const enrolled = await isEnrolled(userId, lesson.module.courseId, ctx.tenant.id);
  if (!enrolled) throw notFound("Enroll in the course first");

  const existing = await prisma.completedLesson.findFirst({
    where: { userId, lessonId, tenantId: ctx.tenant.id },
  });
  if (existing) {
    await prisma.completedLesson.delete({ where: { id: existing.id } });
    return { completed: false };
  }
  await prisma.completedLesson.create({
    data: { userId, lessonId, tenantId: ctx.tenant.id },
  });
  return { completed: true };
}

export async function getCourseProgress(ctx: TenantContext, courseId: string) {
  const userId = ctx.user.id;
  const [lessons, completedRows] = await Promise.all([
    prisma.lesson.findMany({
      where: { module: { courseId }, tenantId: ctx.tenant.id },
      select: { id: true },
    }),
    prisma.completedLesson.findMany({
      where: { userId, tenantId: ctx.tenant.id, lesson: { module: { courseId } } },
      select: { lessonId: true },
    }),
  ]);
  const completedSet = new Set(completedRows.map((c) => c.lessonId));
  const completedLessons = lessons.filter((l) => completedSet.has(l.id)).length;
  const totalLessons = lessons.length;
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  return { completedLessons, totalLessons, percent };
}
