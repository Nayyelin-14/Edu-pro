/**
 * Read-only helpers for roadmap retrieval.
 * Separated so the API routes don't duplicate logic and the service stays focused
 * on the generation pipeline.
 */
import { prisma } from "@/lib/prisma";
import { deriveItemStatus } from "./roadmap.status";
import { RoadmapItemStatus } from "@/generated/prisma/enums";

export interface RoadmapSummary {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: Date;
  totalStages: number;
  matchedStages: number;
  completedStages: number;
  progressPercent: number;
  saved: boolean;
}

export interface RoadmapDetail extends RoadmapSummary {
  items: RoadmapItemDetail[];
  generation: RoadmapGenerationInfo;
}

export interface RoadmapGenerationInfo {
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  generatedAt: Date | null;
  usageSource: "provider_reported" | "calculated" | "unavailable" | null;
  attemptCount: number | null;
  retryCount: number | null;
}

export interface RoadmapItemDetail {
  id: string;
  stageNumber: number;
  title: string;
  description: string | null;
  goal: string | null;
  weekStart: number;
  weekEnd: number;
  courseId: string | null;
  courseTitle: string | null;
  courseReason: string | null;
  courseSlug: string | null;
  status: RoadmapItemStatus;
  isTopic: boolean;
  courseProgress: {
    percent: number;
    completedLessons: number;
    totalLessons: number;
  } | null;
}

export interface RoadmapRepoRead {
  getMyRoadmaps(userId: string): Promise<RoadmapSummary[]>;
  getMyRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null>;
  saveMyRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null>;
  deleteMyRoadmap(userId: string, roadmapId: string): Promise<boolean>;
}

export class PrismaRoadmapReadRepo implements RoadmapRepoRead {
  async getMyRoadmaps(userId: string): Promise<RoadmapSummary[]> {
    const roadmaps = await prisma.roadmap.findMany({
      where: { userId, saved: true },
include: {
          items: {
            select: {
              id: true,
              stageNumber: true,
              courseId: true,
              course: { select: { title: true, slug: true } },
              status: true,
              weekStart: true,
              weekEnd: true,
            },
          },
        },
      orderBy: { createdAt: "desc" },
    });

    return roadmaps.map((r) => {
      const matched = r.items.filter((i) => i.courseId !== null);
      const completed = r.items.filter((i) => i.status === "COMPLETED");
      const matchedCount = matched.length;
      const completedCount = completed.length;
      const total = r.items.length;

      return {
        id: r.id,
        title: r.title,
        goal: r.goal,
        level: r.level,
        durationWeeks: r.durationWeeks,
        hoursPerWeek: r.hoursPerWeek,
        language: r.language,
        createdAt: r.createdAt,
        saved: r.saved,
        totalStages: total,
        matchedStages: matchedCount,
        completedStages: completedCount,
        progressPercent: matchedCount === 0 ? 0 : Math.round((completedCount / matchedCount) * 100),
      };
    });
  }

  async getMyRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null> {
    const row = await prisma.roadmap.findFirst({
      where: { id: roadmapId, userId },
      include: {
        items: {
          orderBy: { stageNumber: "asc" },
          include: {
            course: { select: { title: true, slug: true, modules: { select: { lessons: { select: { id: true } } } } } },
          },
        },
      },
    });

    if (!row) return null;

    // Fetch enrollments + completed lessons for this user for all matched courses
    const courseIds = row.items.filter((i) => i.courseId).map((i) => i.courseId!);
    const enrollmentMap = new Map<string, { enrolled: boolean; completedLessons: number; totalLessons: number; percent: number }>();
    if (courseIds.length > 0) {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId, courseId: { in: courseIds } },
        include: { course: { select: { modules: { select: { lessons: { select: { id: true } } } } } } },
      });
      const completed = await prisma.completedLesson.findMany({
        where: { userId, lesson: { module: { courseId: { in: courseIds } } } },
        select: { lessonId: true },
      });
      const completedLessonIds = new Set(completed.map((c) => c.lessonId));

      for (const e of enrollments) {
        const total = e.course.modules.reduce((a, m) => a + m.lessons.length, 0);
        const done = e.course.modules.flatMap((m) => m.lessons).filter((l) => completedLessonIds.has(l.id)).length;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);
        enrollmentMap.set(e.courseId, { enrolled: true, completedLessons: done, totalLessons: total, percent });
      }
    }

    const items: RoadmapItemDetail[] = row.items.map((i) => {
      const enrollment = i.courseId ? enrollmentMap.get(i.courseId) : null;
      const status = deriveItemStatus({
        courseId: i.courseId,
        enrolled: enrollment?.enrolled ?? false,
        completedLessons: enrollment?.completedLessons ?? 0,
        totalLessons: enrollment?.totalLessons ?? 0,
        isTopic: i.courseId === null,
      });
      return {
        id: i.id,
        stageNumber: i.stageNumber,
        title: i.title,
        description: i.description,
        goal: i.goal,
        weekStart: i.weekStart,
        weekEnd: i.weekEnd,
        courseId: i.courseId,
        courseTitle: i.course?.title ?? null,
        courseReason: i.courseReason,
        courseSlug: i.course?.slug ?? null,
        status,
        isTopic: i.courseId === null,
        courseProgress: enrollment
          ? { percent: enrollment.percent, completedLessons: enrollment.completedLessons, totalLessons: enrollment.totalLessons }
          : null,
      };
    });

    const matched = items.filter((i) => i.courseId !== null);
    const completed = items.filter((i) => i.status === "COMPLETED");
    const matchedCount = matched.length;
    const completedCount = completed.length;

    return {
      id: row.id,
      title: row.title,
      goal: row.goal,
      level: row.level,
      durationWeeks: row.durationWeeks,
      hoursPerWeek: row.hoursPerWeek,
      language: row.language,
      createdAt: row.createdAt,
      saved: row.saved,
      totalStages: row.items.length,
      matchedStages: matched.length,
      completedStages: completed.length,
      progressPercent: matchedCount === 0 ? 0 : Math.round((completedCount / matchedCount) * 100),
      items,
      generation: {
        provider: row.provider,
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        totalTokens: row.totalTokens,
        durationMs: row.durationMs,
        generatedAt: row.generatedAt,
        usageSource: row.usageSource,
        attemptCount: row.attemptCount,
        retryCount: row.retryCount,
      },
    };
  }

  async saveMyRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null> {
    // Idempotent: no-op when already saved; 404-worthy when it's not the user's.
    await prisma.roadmap.updateMany({
      where: { id: roadmapId, userId },
      data: { saved: true, savedAt: new Date() },
    });
    return this.getMyRoadmap(userId, roadmapId);
  }

  async deleteMyRoadmap(userId: string, roadmapId: string): Promise<boolean> {
    const result = await prisma.roadmap.deleteMany({ where: { id: roadmapId, userId } });
    return result.count > 0;
  }
}

/** Export the production repo instance. */
export const roadmapReadRepo = new PrismaRoadmapReadRepo();