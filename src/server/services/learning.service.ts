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
  // Idempotent: if the lesson is already complete, keep it complete. This
  // guarantees repeated "Mark as Complete" clicks never double-count or
  // accidentally un-complete (which would drop progress).
  if (existing) return { completed: true };
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

/** A single navigable item in a course: a lesson or a quiz. */
export interface LearningItem {
  type: "lesson" | "quiz";
  id: string;
  moduleId: string;
  title: string;
  position: number;
}

/**
 * Flat, ordered list of every lesson and quiz in the course, across all
 * modules, sorted by module position then by item position. This is the single
 * source of truth for "what comes next" so lessons and quizzes share one
 * consistent navigation order.
 */
export async function getOrderedItems(ctx: TenantContext, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, position: true },
          },
          quizzes: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, position: true },
          },
        },
      },
    },
  });
  const items: LearningItem[] = [];
  for (const m of course?.modules ?? []) {
    const merged: LearningItem[] = [
      ...m.lessons.map((l) => ({
        type: "lesson" as const,
        id: l.id,
        moduleId: m.id,
        title: l.title,
        position: l.position,
      })),
      ...m.quizzes.map((q) => ({
        type: "quiz" as const,
        id: q.id,
        moduleId: m.id,
        title: q.title,
        position: q.position,
      })),
    ].sort((a, b) => a.position - b.position || (a.type === "lesson" ? -1 : 1));
    items.push(...merged);
  }
  return items;
}

/**
 * Course-wide progress across BOTH lessons and quizzes (the final exam / Test
 * is excluded — it is a separate assessment). A quiz counts as complete only
 * when it has been passed.
 */
export async function getItemProgress(ctx: TenantContext, courseId: string) {
  const userId = ctx.user.id;
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    include: {
      modules: {
        select: {
          lessons: { select: { id: true } },
          quizzes: { select: { id: true } },
        },
      },
    },
  });
  const lessonIds = (course?.modules ?? []).flatMap((m) => m.lessons.map((l) => l.id));
  const quizIds = (course?.modules ?? []).flatMap((m) => m.quizzes.map((q) => q.id));
  const totalItems = lessonIds.length + quizIds.length;

  const [completedLessonRows, completedQuizRows] = await Promise.all([
    lessonIds.length > 0
      ? prisma.completedLesson.findMany({
          where: { userId, lessonId: { in: lessonIds }, tenantId: ctx.tenant.id },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    quizIds.length > 0
      ? prisma.quizResult.findMany({
          where: { userId, quizId: { in: quizIds }, passed: true, tenantId: ctx.tenant.id },
          select: { quizId: true },
        })
      : Promise.resolve([]),
  ]);

  const completedItems = completedLessonRows.length + completedQuizRows.length;
  const percent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
  return {
    totalItems,
    completedItems,
    percent,
    totalLessons: lessonIds.length,
    totalQuizzes: quizIds.length,
    completedLessons: completedLessonRows.length,
    completedQuizzes: completedQuizRows.length,
  };
}

export interface NextItemResult {
  hasNext: boolean;
  courseCompleted: boolean;
  nextItem: LearningItem | null;
  /**
   * The first item the learner still hasn't completed. Only populated when the
   * finished item is the last in sequence but the course is still incomplete —
   * the client uses it to offer a "jump to next unfinished" link instead of an
   * incorrect auto-redirect.
   */
  firstIncomplete: LearningItem | null;
  progress: { completedItems: number; totalItems: number; percent: number };
}

/**
 * Returns the item that follows `currentItemId` in the course's unified
 * lesson/quiz order. When the current item is the last one, this also marks the
 * enrollment as completed (idempotent). If the course still has incomplete
 * items, it falls back to the first incomplete item so the learner is never
 * left without a next step.
 */
export async function getNextItem(
  ctx: TenantContext,
  courseId: string,
  currentItemId: string,
  currentItemType: "lesson" | "quiz",
): Promise<NextItemResult> {
  const userId = ctx.user.id;
  const items = await getOrderedItems(ctx, courseId);
  if (items.length === 0) {
    return { hasNext: false, courseCompleted: true, nextItem: null, firstIncomplete: null, progress: { completedItems: 0, totalItems: 0, percent: 0 } };
  }

  // Completion state for the whole course.
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    include: {
      modules: {
        select: {
          lessons: { select: { id: true } },
          quizzes: { select: { id: true } },
        },
      },
    },
  });
  const lessonIds = (course?.modules ?? []).flatMap((m) => m.lessons.map((l) => l.id));
  const quizIds = (course?.modules ?? []).flatMap((m) => m.quizzes.map((q) => q.id));
  const [completedLessonRows, completedQuizRows] = await Promise.all([
    prisma.completedLesson.findMany({
      where: { userId, lessonId: { in: lessonIds }, tenantId: ctx.tenant.id },
      select: { lessonId: true },
    }),
    prisma.quizResult.findMany({
      where: { userId, quizId: { in: quizIds }, passed: true, tenantId: ctx.tenant.id },
      select: { quizId: true },
    }),
  ]);
  const completedLessonSet = new Set(completedLessonRows.map((c) => c.lessonId));
  const completedQuizSet = new Set(completedQuizRows.map((q) => q.quizId));
  const totalItems = lessonIds.length + quizIds.length;
  const completedItems = completedLessonSet.size + completedQuizSet.size;
  const percent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
  const isCourseComplete = totalItems > 0 && completedItems === totalItems;
  const progress = { completedItems, totalItems, percent };

  const idx = items.findIndex(
    (i) => i.id === currentItemId && i.type === currentItemType,
  );
  if (idx === -1) {
    // Current item isn't part of this course's ordered list. Surface the
    // end-of-content state (with a link to the first unfinished item) rather
    // than silently doing nothing or guessing a "next".
    const firstIncomplete = isCourseComplete
      ? null
      : items.find((i) =>
          i.type === "lesson" ? !completedLessonSet.has(i.id) : !completedQuizSet.has(i.id),
        ) ?? null;
    return {
      hasNext: false,
      courseCompleted: isCourseComplete,
      nextItem: null,
      firstIncomplete,
      progress,
    };
  }

  const next = items[idx + 1] ?? null;
  if (next) {
    // Normal case: always go to the item that physically follows the one just
    // finished, regardless of completion state. This is what makes manual
    // jumps (forward or backward) always land on the correct next item.
    return { hasNext: true, courseCompleted: false, nextItem: next, firstIncomplete: null, progress };
  }

  // Current item is the last one in the course's sequence.
  if (isCourseComplete) {
    await prisma.enrollment.updateMany({
      where: { userId, courseId, tenantId: ctx.tenant.id, completedAt: null },
      data: { completedAt: new Date() },
    });
    return { hasNext: false, courseCompleted: true, nextItem: null, firstIncomplete: null, progress };
  }

  // Last item finished, but the course is still incomplete elsewhere. We must
  // NOT auto-redirect to an unrelated earlier lesson (that was the bug).
  // Instead surface an end-of-content screen that links to the first unfinished
  // item so the learner can choose where to go next.
  const firstIncomplete = items.find((i) =>
    i.type === "lesson" ? !completedLessonSet.has(i.id) : !completedQuizSet.has(i.id),
  ) ?? null;
  return {
    hasNext: false,
    courseCompleted: false,
    nextItem: null,
    firstIncomplete,
    progress,
  };
}
