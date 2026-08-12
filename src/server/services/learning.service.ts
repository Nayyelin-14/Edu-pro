import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { isEnrolled } from "./enrollment.service";

export async function toggleLessonComplete(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw notFound("Lesson not found");

  const enrolled = await isEnrolled(userId, lesson.module.courseId);
  if (!enrolled) throw notFound("Enroll in the course first");

  const existing = await prisma.completedLesson.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  if (existing) {
    await prisma.completedLesson.delete({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return { completed: false };
  }
  await prisma.completedLesson.create({ data: { userId, lessonId } });
  return { completed: true };
}

export async function getCourseProgress(userId: string, courseId: string) {
  const [lessons, completedRows] = await Promise.all([
    prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true },
    }),
    prisma.completedLesson.findMany({
      where: { userId, lesson: { module: { courseId } } },
      select: { lessonId: true },
    }),
  ]);
  const completedSet = new Set(completedRows.map((c) => c.lessonId));
  const completedLessons = lessons.filter((l) => completedSet.has(l.id)).length;
  const totalLessons = lessons.length;
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  return { completedLessons, totalLessons, percent };
}
