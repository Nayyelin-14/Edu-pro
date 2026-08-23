/**
 * Read-only helpers for roadmap retrieval.
 *
 * Progress is ALWAYS derived from real learning data (Enrollment,
 * CompletedLesson, QuizResult, TestResult, Certificate) — never from stored
 * counters. Item statuses come from `deriveItemStatus`, and the roadmap's own
 * lifecycle status (DRAFT -> SAVED -> ACTIVE -> COMPLETED) is recomputed on
 * read and opportunistically persisted.
 */
import { prisma } from "@/lib/prisma";
import { deriveItemStatus } from "./roadmap.status";
import { RoadmapItemStatus, RoadmapStatus } from "@/generated/prisma/enums";

export type RoadmapNextAction =
  | { type: "start"; courseId: string; courseTitle: string; courseSlug: string | null }
  | { type: "continue"; courseId: string; courseTitle: string; courseSlug: string | null }
  | { type: "complete"; courseId: string; courseTitle: string; courseSlug: string | null }
  | { type: "none" };

export interface RoadmapSummary {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: Date;
  status: RoadmapStatus;
  saved: boolean;
  catalogCoverage: string;
  missingSkills: string[];
  shortExplanation: string | null;
  goalCoverage: number;
  courseAvailability: number;
  roadmapQuality: string;
  confidence: number;
  assumptions: string[];
  totalStages: number;
  matchedStages: number;
  completedStages: number;
  progressPercent: number;
  estimatedDuration: number;
  nextAction: RoadmapNextAction;
}

export interface RoadmapInterpretationView {
  /** The goal interpretation used for this roadmap (AI or deterministic). */
  goalAnalysis: {
    role: string | null;
    roleId: string | null;
    roleSource: "profile" | "general" | "none" | null;
    roleConfidence: number;
    domain: string | null;
    domainConfidence: number;
    confidence: number;
    assumptions: string[];
    skills: string[];
    knownSkills: string[];
    level: string | null;
  } | null;
  /** The competency model (skills) the roadmap was built against. */
  requiredSkills: Array<{
    skill: string;
    importance: "critical" | "important" | "optional";
    category: "foundational" | "core" | "advanced";
    source: "profile" | "goal";
    prerequisites?: string[];
  }> | null;
}

export interface RoadmapDetail extends RoadmapSummary {
  items: RoadmapItemDetail[];
  coverageBreakdown: CoverageBreakdownView | null;
  generation: RoadmapGenerationInfo;
  /** Server-side interpretation + competency model (never AI-asserted). */
  interpretation: RoadmapInterpretationView | null;
}

export interface CoverageBreakdownView {
  goalCoverage: number;
  courseAvailability: number;
  skills: Array<{
    skill: string;
    importance: "critical" | "important" | "optional";
    category: "foundational" | "core" | "advanced";
    status: "complete" | "partial" | "weak" | "unavailable";
    reason: string;
    quality: "excellent" | "good" | "partial" | "insufficient";
    matchedCourseIds: string[];
    catalogCourseIds: string[];
  }>;
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
  skills: string[];
  milestones: string[];
  estimatedWeeks: number;
  matchQuality: string | null;
  courseProgress: {
    percent: number;
    completedLessons: number;
    totalLessons: number;
  } | null;
}

export interface RoadmapRepoRead {
  getMyRoadmaps(userId: string, tenantId?: string): Promise<RoadmapSummary[]>;
  getPendingDraft(userId: string): Promise<RoadmapSummary | null>;
  getMyRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null>;
  saveMyRoadmap(userId: string, roadmapId: string): Promise<RoadmapDetail | null>;
  deleteMyRoadmap(userId: string, roadmapId: string, tenantId?: string): Promise<boolean>;
}

/** Upgrade-only lifecycle transition: a roadmap never regresses a status. */
function transitionStatus(current: RoadmapStatus, desired: RoadmapStatus): RoadmapStatus {
  const order: RoadmapStatus[] = [RoadmapStatus.DRAFT, RoadmapStatus.SAVED, RoadmapStatus.ACTIVE, RoadmapStatus.COMPLETED];
  const cur = order.indexOf(current);
  const want = order.indexOf(desired);
  if (cur < 0 || want < 0 || cur < want) return desired;
  return current;
}

/** Aggregated progress over the real courses in the path. */
interface ProgressAggregate {
  completedLessons: number;
  totalLessons: number;
  percent: number;
  completedStages: number;
  inProgress: boolean;
}

type MatchedItem = {
  courseId: string;
  status: RoadmapItemStatus;
  title: string;
  slug: string | null;
  courseTitle: string | null;
  estimatedWeeks: number;
  weekStart: number;
  weekEnd: number;
};

function summarize(
  roadmap: { id: string; title: string; goal: string; level: string; durationWeeks: number; hoursPerWeek: number; language: string; createdAt: Date; status: RoadmapStatus; saved: boolean; catalogCoverage: string; missingSkills: unknown; shortExplanation: string | null; goalCoverage: number; courseAvailability: number; roadmapQuality: string; confidence: number; assumptions: unknown },
  matched: MatchedItem[],
  completedStages: number,
  percent: number,
): Omit<RoadmapSummary, "nextAction"> & { status: RoadmapStatus } {
  const estimatedDuration = matched.reduce((acc, m) => acc + Math.max(0, m.estimatedWeeks), 0);
  return {
    id: roadmap.id,
    title: roadmap.title,
    goal: roadmap.goal,
    level: roadmap.level,
    durationWeeks: roadmap.durationWeeks,
    hoursPerWeek: roadmap.hoursPerWeek,
    language: roadmap.language,
    createdAt: roadmap.createdAt,
    status: roadmap.status,
    saved: roadmap.saved,
    catalogCoverage: roadmap.catalogCoverage,
    missingSkills: Array.isArray(roadmap.missingSkills) ? (roadmap.missingSkills as string[]) : [],
    shortExplanation: roadmap.shortExplanation,
    goalCoverage: roadmap.goalCoverage,
    courseAvailability: roadmap.courseAvailability,
    roadmapQuality: roadmap.roadmapQuality,
    confidence: roadmap.confidence,
    assumptions: Array.isArray(roadmap.assumptions) ? (roadmap.assumptions as string[]) : [],
    totalStages: 0,
    matchedStages: matched.length,
    completedStages,
    progressPercent: percent,
    estimatedDuration,
  };
}

function pickNextAction(matched: MatchedItem[]): RoadmapNextAction {
  if (matched.length === 0) return { type: "none" };
  const target = (m: MatchedItem): RoadmapNextAction => ({
    type: m.status === RoadmapItemStatus.COMPLETED ? "complete" : m.status === RoadmapItemStatus.IN_PROGRESS ? "continue" : "start",
    courseId: m.courseId,
    courseTitle: m.courseTitle ?? m.title,
    courseSlug: m.slug,
  });
  const inProgress = matched.find((m) => m.status === RoadmapItemStatus.IN_PROGRESS);
  if (inProgress) return target(inProgress);
  const notStarted = matched.find((m) => m.status === RoadmapItemStatus.NOT_STARTED);
  if (notStarted) return target(notStarted);
  return target(matched[matched.length - 1]!);
}

export class PrismaRoadmapReadRepo implements RoadmapRepoRead {
  async getMyRoadmaps(userId: string, tenantId?: string): Promise<RoadmapSummary[]> {
    const roadmaps = await prisma.roadmap.findMany({
      where: { userId, saved: true, ...(tenantId ? { tenantId } : {}) },
      select: {
        id: true,
        title: true,
        goal: true,
        level: true,
        durationWeeks: true,
        hoursPerWeek: true,
        language: true,
        createdAt: true,
        status: true,
        saved: true,
        catalogCoverage: true,
        missingSkills: true,
        shortExplanation: true,
        goalCoverage: true,
        courseAvailability: true,
        roadmapQuality: true,
        confidence: true,
        assumptions: true,
        items: {
          select: {
            courseId: true,
            isTopic: true,
            course: { select: { title: true, slug: true, modules: { select: { lessons: { select: { id: true } } } } } },
            status: true,
            title: true,
            estimatedWeeks: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const courseIds = [...new Set(roadmaps.flatMap((r) => r.items.filter((i) => i.courseId).map((i) => i.courseId!)))];
    const progressMap = courseIds.length ? await this.loadCourseProgress(userId, courseIds, tenantId) : new Map<string, ProgressAggregate>();

    return roadmaps.map((r) => {
      const matched = r.items
        .filter((i) => i.courseId)
        .map<MatchedItem>((i) => ({
          courseId: i.courseId!,
          status: deriveItemStatusForProgress(i, progressMap.get(i.courseId!)),
          title: i.title,
          slug: i.course?.slug ?? null,
          courseTitle: i.course?.title ?? null,
          estimatedWeeks: i.estimatedWeeks ?? 0,
          weekStart: 0,
          weekEnd: 0,
        }));
      const agg = aggregate(matched, progressMap);
      const base = summarize(r, matched, agg.completedStages, agg.percent);
      return {
        ...base,
        totalStages: r.items.length,
        nextAction: pickNextAction(matched),
      };
    });
  }

  /** Returns the most recent unsaved draft (if any) so the list can nudge the user. */
  async getPendingDraft(userId: string, tenantId?: string): Promise<RoadmapSummary | null> {
    const row = await prisma.roadmap.findFirst({
      where: { userId, saved: false, ...(tenantId ? { tenantId } : {}) },
      select: {
        id: true,
        title: true,
        goal: true,
        level: true,
        durationWeeks: true,
        hoursPerWeek: true,
        language: true,
        createdAt: true,
        status: true,
        saved: true,
        catalogCoverage: true,
        missingSkills: true,
        shortExplanation: true,
        goalCoverage: true,
        courseAvailability: true,
        roadmapQuality: true,
        confidence: true,
        assumptions: true,
        items: {
          select: {
            courseId: true,
            isTopic: true,
            course: { select: { title: true, slug: true, modules: { select: { lessons: { select: { id: true } } } } } },
            status: true,
            title: true,
            estimatedWeeks: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!row) return null;

    const courseIds = row.items.filter((i) => i.courseId).map((i) => i.courseId!);
    const progressMap = courseIds.length ? await this.loadCourseProgress(userId, courseIds, tenantId) : new Map<string, ProgressAggregate>();
    const matched = row.items
      .filter((i) => i.courseId)
      .map<MatchedItem>((i) => ({
        courseId: i.courseId!,
        status: deriveItemStatusForProgress(i, progressMap.get(i.courseId!)),
        title: i.title,
        slug: i.course?.slug ?? null,
        courseTitle: i.course?.title ?? null,
        estimatedWeeks: i.estimatedWeeks ?? 0,
        weekStart: 0,
        weekEnd: 0,
      }));
    const agg = aggregate(matched, progressMap);
    const base = summarize(row, matched, agg.completedStages, agg.percent);
    return {
      ...base,
      totalStages: row.items.length,
      nextAction: pickNextAction(matched),
    };
  }

  async getMyRoadmap(userId: string, roadmapId: string, tenantId?: string): Promise<RoadmapDetail | null> {
    const row = await prisma.roadmap.findFirst({
      where: { id: roadmapId, userId, ...(tenantId ? { tenantId } : {}) },
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

    const courseIds = row.items.filter((i) => i.courseId).map((i) => i.courseId!);
    const progressMap = courseIds.length ? await this.loadCourseProgress(userId, courseIds, tenantId) : new Map<string, ProgressAggregate>();

    const items: RoadmapItemDetail[] = row.items.map((i) => {
      const agg = i.courseId ? progressMap.get(i.courseId) : undefined;
      const status = deriveItemStatusForProgress(i, agg);
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
        isTopic: i.courseId === null || i.isTopic,
        skills: Array.isArray(i.skills) ? (i.skills as string[]) : [],
        milestones: Array.isArray(i.milestones) ? (i.milestones as string[]) : [],
        estimatedWeeks: i.estimatedWeeks ?? 0,
        matchQuality: i.matchQuality ?? null,
        matchedCompetencies: Array.isArray(i.matchedCompetencies) ? (i.matchedCompetencies as string[]) : [],
        courseProgress: agg
          ? { percent: agg.percent, completedLessons: agg.completedLessons, totalLessons: agg.totalLessons }
          : null,
      };
    });

    const matched = items.filter((i): i is RoadmapItemDetail & { courseId: string } => i.courseId !== null);
    const matchedForAction: MatchedItem[] = matched.map((i) => ({
      courseId: i.courseId,
      status: i.status,
      title: i.title,
      slug: i.courseSlug,
      courseTitle: i.courseTitle,
      estimatedWeeks: i.estimatedWeeks,
      weekStart: i.weekStart,
      weekEnd: i.weekEnd,
    }));
    const agg = aggregate(matchedForAction, progressMap);

    // Opportunistic lifecycle transition: never regress a status, but promote
    // ACTIVE as soon as the learner starts a course and COMPLETED when all
    // real courses are finished.
    const desired =
      matchedForAction.length > 0 && agg.completedStages === matchedForAction.length
        ? RoadmapStatus.COMPLETED
        : agg.inProgress
          ? RoadmapStatus.ACTIVE
          : row.saved
            ? RoadmapStatus.SAVED
            : RoadmapStatus.DRAFT;
    const status = transitionStatus(row.status, desired);
    if (status !== row.status) {
      await prisma.roadmap.updateMany({ where: { id: row.id, userId }, data: { status } });
      row.status = status;
    }

    const base = summarize(row, matchedForAction, agg.completedStages, agg.percent);
    return {
      ...base,
      totalStages: row.items.length,
      nextAction: pickNextAction(matchedForAction),
      items,
      coverageBreakdown: parseCoverageBreakdown(row.coverageBreakdown),
      interpretation: parseInterpretation(row.interpretation),
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

  /** Real per-course progress for a user across the given course ids. */
  private async loadCourseProgress(
    userId: string,
    courseIds: string[],
    tenantId?: string,
  ): Promise<Map<string, ProgressAggregate>> {
    // TENANT MODE: progress is only meaningful inside the roadmap's tenant.
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, courseId: { in: courseIds }, ...(tenantId ? { tenantId } : {}) },
      select: { courseId: true, course: { select: { modules: { select: { lessons: { select: { id: true } } } } } } },
    });
    const completedRows = await prisma.completedLesson.findMany({
      where: { userId, ...(tenantId ? { tenantId } : {}), lesson: { module: { courseId: { in: courseIds } } } },
      select: { lessonId: true },
    });
    const completedSet = new Set(completedRows.map((c) => c.lessonId));

    const map = new Map<string, ProgressAggregate>();
    for (const e of enrollments) {
      const totalLessons = e.course.modules.reduce((a, m) => a + m.lessons.length, 0);
      const completedLessons = e.course.modules
        .flatMap((m) => m.lessons)
        .filter((l) => completedSet.has(l.id)).length;
      map.set(e.courseId, {
        completedLessons,
        totalLessons,
        percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
        completedStages: 0,
        inProgress: completedLessons > 0 && completedLessons < totalLessons,
      });
    }
    return map;
  }

  async saveMyRoadmap(userId: string, roadmapId: string, tenantId?: string): Promise<RoadmapDetail | null> {
    await prisma.roadmap.updateMany({
      where: { id: roadmapId, userId, ...(tenantId ? { tenantId } : {}) },
      data: { saved: true, savedAt: new Date() },
    });
    return this.getMyRoadmap(userId, roadmapId, tenantId);
  }

  async deleteMyRoadmap(
    userId: string,
    roadmapId: string,
    tenantId?: string,
  ): Promise<boolean> {
    // TENANT MODE: when a trusted tenantId is supplied, cross-tenant rows are
    // invisible (deleteMany count 0 -> 404).
    const result = await prisma.roadmap.deleteMany({
      where: { id: roadmapId, userId, ...(tenantId ? { tenantId } : {}) },
    });
    return result.count > 0;
  }
}

/** Derive an item status from real progress data (enrollment optional). */
function deriveItemStatusForProgress(
  item: { courseId: string | null; isTopic: boolean | null },
  agg: ProgressAggregate | undefined,
): RoadmapItemStatus {
  if (!item.courseId || item.isTopic) return RoadmapItemStatus.SUGGESTED;
  return deriveItemStatus({
    courseId: item.courseId,
    enrolled: agg !== undefined,
    completedLessons: agg?.completedLessons ?? 0,
    totalLessons: agg?.totalLessons ?? 0,
  });
}

function aggregate(matched: MatchedItem[], progressMap: Map<string, ProgressAggregate>) {
  let completedLessons = 0;
  let totalLessons = 0;
  let completedStages = 0;
  let inProgress = false;
  for (const m of matched) {
    const agg = progressMap.get(m.courseId);
    completedLessons += agg?.completedLessons ?? 0;
    totalLessons += agg?.totalLessons ?? 0;
    if (m.status === RoadmapItemStatus.COMPLETED) completedStages += 1;
    if (m.status === RoadmapItemStatus.IN_PROGRESS) inProgress = true;
  }
  return {
    completedLessons,
    totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    completedStages,
    inProgress,
  };
}

/** Export the production repo instance. */
export const roadmapReadRepo = new PrismaRoadmapReadRepo();

/** Safely parse the persisted coverage breakdown (Json) into the view shape. */
function parseCoverageBreakdown(raw: unknown): CoverageBreakdownView | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CoverageBreakdownView>;
  const skills = Array.isArray(value.skills) ? (value.skills as CoverageBreakdownView["skills"]) : [];
  return {
    goalCoverage: typeof value.goalCoverage === "number" ? value.goalCoverage : 0,
    courseAvailability: typeof value.courseAvailability === "number" ? value.courseAvailability : 0,
    skills,
  };
}

/** Safely parse the persisted interpretation JSON into the view shape. */
function parseInterpretation(raw: unknown): RoadmapInterpretationView | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { goalAnalysis?: unknown; requiredSkills?: unknown };

  const ga = value.goalAnalysis;
  let goalAnalysis: RoadmapInterpretationView["goalAnalysis"] = null;
  if (ga && typeof ga === "object") {
    const g = ga as Record<string, unknown>;
    goalAnalysis = {
      role: typeof g.role === "string" ? g.role : null,
      roleId: typeof g.roleId === "string" ? g.roleId : null,
      roleSource: g.roleSource === "profile" || g.roleSource === "general" || g.roleSource === "none" ? g.roleSource : null,
      roleConfidence: typeof g.roleConfidence === "number" ? g.roleConfidence : 0,
      domain: typeof g.domain === "string" ? g.domain : null,
      domainConfidence: typeof g.domainConfidence === "number" ? g.domainConfidence : 0,
      confidence: typeof g.confidence === "number" ? g.confidence : 0,
      assumptions: Array.isArray(g.assumptions) ? (g.assumptions as string[]) : [],
      skills: Array.isArray(g.skills) ? (g.skills as string[]) : [],
      knownSkills: Array.isArray(g.knownSkills) ? (g.knownSkills as string[]) : [],
      level: typeof g.level === "string" ? g.level : null,
    };
  }

  const rs = value.requiredSkills;
  let requiredSkills: RoadmapInterpretationView["requiredSkills"] = null;
  if (Array.isArray(rs)) {
    requiredSkills = rs
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        skill: typeof r.skill === "string" ? r.skill : "",
        importance:
          r.importance === "critical" || r.importance === "important" || r.importance === "optional"
            ? (r.importance as "critical" | "important" | "optional")
            : "important",
        category:
          r.category === "foundational" || r.category === "core" || r.category === "advanced"
            ? (r.category as "foundational" | "core" | "advanced")
            : "core",
        source: r.source === "profile" || r.source === "goal" ? (r.source as "profile" | "goal") : "goal",
        ...(Array.isArray(r.prerequisites) ? { prerequisites: r.prerequisites as string[] } : {}),
      }))
      .filter((r) => r.skill.length > 0);
  }

  return { goalAnalysis, requiredSkills };
}