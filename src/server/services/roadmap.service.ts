/**
 * AI Personalized Learning Roadmap — server orchestration.
 *
 * This is the planner. It does NOT call the AI provider directly; instead it
 * receives an AIProvider and repository functions so it can be unit-tested with
 * in-memory fakes and no network/DB.
 *
 * Pipeline:
 *   1. duplicate detection (24h)
 *   2. skill extraction (deterministic)
 *   3. course retrieval (real, published only)
 *   4. relevance ranking (deterministic)
 *   5. user progress lookup (existing Enrollment/CompletedLesson)
 *   6. LLM call
 *   7. Zod validation of AI output
 *   8. course-resolution against the REAL catalog (hallucination guard)
 *   9. persist
 *
 * The AI never writes to the DB, never decides IDs, and never sees user
 * identity beyond "this course is completed / in-progress".
 */
import type { AIProvider, CourseCandidate, CourseProgress, PlannerContext } from "@/lib/ai/provider";
import { extractSkills, rankAndFilter } from "@/lib/ai/retrieval";
import { createHash } from "node:crypto";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  aiRoadmapPlanSchema,
  type AIRoadmapPlanRaw,
  type GenerateRoadmapInput,
  type RoadmapLevel,
} from "@/lib/validation/roadmap";
import { Prisma } from "@/generated/prisma/client";
import { GenerationStatus, RoadmapItemStatus } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Repositories (injectable so tests can fake them)
// ---------------------------------------------------------------------------

export interface GenerationClaim {
  userId: string;
  fingerprint: string;
  expiresAt: Date;
}

export interface RoadmapRepo {
  findRecentDuplicate(opts: {
    userId: string;
    goal: string;
    level: RoadmapLevel;
    durationWeeks: number;
    hoursPerWeek: number;
    language: string;
  }): Promise<ExistingRoadmap | null>;
  loadCatalog(): Promise<CourseCandidate[]>;
  loadProgress(userId: string): Promise<Map<string, CourseProgress>>;
  persist(roadmap: PersistRoadmap): Promise<RoadmapResult>;
  /**
   * Atomically claim the right to generate a roadmap for (userId, fingerprint).
   * Backed by a UNIQUE index on (userId, fingerprint), so at most one caller
   * can hold a claim per fingerprint at any time — even across server
   * instances. Returns true if this caller now owns the claim.
   */
  claimGeneration(claim: GenerationClaim): Promise<boolean>;
  /**
   * Resolve a blocked claim slot:
   *  - steal an expired GENERATING claim (crash recovery),
   *  - clear stale COMPLETED/FAILED rows and re-claim (24h re-generation).
   * Returns "acquired" when this caller now owns the claim, "busy" otherwise.
   */
  resolveGeneration(claim: GenerationClaim): Promise<"acquired" | "busy">;
  /** Mark an owned claim COMPLETED (with roadmapId) or FAILED. */
  markGeneration(
    claim: Pick<GenerationClaim, "userId" | "fingerprint">,
    status: "COMPLETED" | "FAILED",
    roadmapId?: string,
  ): Promise<void>;
}

export interface ExistingRoadmap {
  id: string;
  title: string;
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: Date;
  items: StoredRoadmapItem[];
}

export interface StoredRoadmapItem {
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
  status: RoadmapItemStatus;
  isTopic: boolean;
}

export interface NormalizedStage {
  stageNumber: number;
  title: string;
  description: string | null;
  goal: string | null;
  weekStart: number;
  weekEnd: number;
  courseId: string | null;
  courseTitle: string | null;
  courseReason: string | null;
  isTopic: boolean;
}

export interface PersistRoadmap {
  userId: string;
  title: string;
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: "en" | "th";
  stages: NormalizedStage[];
}

export interface RoadmapResult {
  id: string;
  title: string;
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: Date;
  items: StoredRoadmapItem[];
  isDuplicate: boolean;
}

// ---------------------------------------------------------------------------
// Service factory (production implementation uses Prisma)
// ---------------------------------------------------------------------------

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CATALOG_LIMIT = 15;
const CATALOG_MIN_SCORE = 1;

// Claim-table lease: how long a GENERATING claim may live before it is
// stealable by another request (crash recovery). Generous vs the 30s provider
// timeout so a slow-but-live generation is never stolen.
const CLAIM_LEASE_MS = 10 * 60 * 1000;
// How long a concurrent duplicate request polls for the winner's roadmap.
const CLAIM_WAIT_MS = 75 * 1000;
// Poll interval for the above.
const CLAIM_POLL_MS = 300;

export function computeFingerprint(
  userId: string,
  input: Pick<GenerateRoadmapInput, "goal" | "level" | "durationWeeks" | "hoursPerWeek" | "language">,
): string {
  const language = input.language ?? "en";
  return createHash("sha256")
    .update([userId, input.goal, input.level, input.durationWeeks, input.hoursPerWeek, language].join("\n"))
    .digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RoadmapServiceOptions {
  /** How long a live GENERATING claim may exist before it is stealable. */
  claimLeaseMs?: number;
  /** How long a concurrent duplicate request polls for the winner. */
  claimWaitMs?: number;
  /** Poll interval for concurrent duplicate requests. */
  claimPollMs?: number;
}

export class RoadmapService {
  private readonly claimLeaseMs: number;
  private readonly claimWaitMs: number;
  private readonly claimPollMs: number;

  constructor(
    private readonly provider: AIProvider,
    opts: RoadmapServiceOptions = {},
  ) {
    this.claimLeaseMs = opts.claimLeaseMs ?? CLAIM_LEASE_MS;
    this.claimWaitMs = opts.claimWaitMs ?? CLAIM_WAIT_MS;
    this.claimPollMs = opts.claimPollMs ?? CLAIM_POLL_MS;
  }

  async generate(
    userId: string,
    input: GenerateRoadmapInput,
    repo: RoadmapRepo,
  ): Promise<RoadmapResult> {
    // [1] duplicate detection — return existing if identical within 24h
    const dupKey = {
      userId,
      goal: input.goal,
      level: input.level,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
    } as const;
    const dupLookup = () => repo.findRecentDuplicate(dupKey);

    const duplicate = await dupLookup();
    if (duplicate) {
      return { ...duplicate, isDuplicate: true };
    }

    // [1b] DB-enforced idempotency: claim the (userId, fingerprint) slot so at
    // most one request per goal calls the AI provider — even across instances.
    const fingerprint = computeFingerprint(userId, input);
    const claim: GenerationClaim = {
      userId,
      fingerprint,
      expiresAt: new Date(Date.now() + this.claimLeaseMs),
    };

    let acquired = await repo.claimGeneration(claim);

    if (!acquired) {
      // Someone else holds a live claim. Either their roadmap appears within
      // the wait window (return it), or their claim is released (steal / clear
      // stale rows) and we take over.
      const deadline = Date.now() + this.claimWaitMs;
      while (Date.now() < deadline) {
        const existing = await dupLookup();
        if (existing) return { ...existing, isDuplicate: true };
        const resolved = await repo.resolveGeneration(claim);
        if (resolved === "acquired") {
          acquired = true;
          break;
        }
        await sleep(this.claimPollMs);
      }
      if (!acquired) {
        const lastChance = await repo.resolveGeneration(claim);
        if (lastChance === "acquired") acquired = true;
      }
    }

    if (!acquired) {
      throw new ApiError(
        503,
        "A roadmap for this goal is already being generated. Please retry in a moment.",
      );
    }

    // We own the claim. Guard against a previous owner that persisted a
    // roadmap but crashed before marking the claim COMPLETED.
    const stale = await dupLookup();
    if (stale) {
      await repo.markGeneration({ userId, fingerprint }, "COMPLETED", stale.id);
      return { ...stale, isDuplicate: true };
    }

    try {
      const created = await this.runGeneration(userId, input, repo);
      await repo.markGeneration({ userId, fingerprint }, "COMPLETED", created.id);
      return created;
    } catch (err) {
      await repo.markGeneration({ userId, fingerprint }, "FAILED").catch(() => {});
      throw err;
    }
  }

  /**
   * The actual generation pipeline. Only called while this request owns the
   * claim for (userId, fingerprint), so exactly one AI call is ever made per
   * distinct goal fingerprint.
   */
  private async runGeneration(
    userId: string,
    input: GenerateRoadmapInput,
    repo: RoadmapRepo,
  ): Promise<RoadmapResult> {
    // [2] skill extraction
    const skills = extractSkills(input.goal);

    // [3] course retrieval + [4] relevance ranking
    const catalog = await repo.loadCatalog();
    const ranked = rankAndFilter(catalog, skills, {
      limit: CATALOG_LIMIT,
      minScore: CATALOG_MIN_SCORE,
    });
    const candidates: CourseCandidate[] = ranked.map((r) => r.candidate);

    // [5] user progress lookup
    const progress = await repo.loadProgress(userId);

    // [6] LLM call (only if there is something to sequence)
    const plan: AIRoadmapPlanRaw = candidates.length
      ? await this.provider.generateRoadmap(this.buildContext(input, candidates, progress, skills))
      : this.fallbackPlan(input);

    // [7] Zod validation of AI output
    const parsed = aiRoadmapPlanSchema.safeParse(plan);
    if (!parsed.success) {
      throw new ApiError(
        502,
        "Unable to generate your roadmap right now. Please try again.",
      );
    }

    // [8] resolve course titles against the REAL catalog (hallucination guard)
    const normalized = this.resolveAndValidateStages(
      parsed.data.stages,
      candidates,
      input.durationWeeks,
    );

    // [9] persist
    return repo.persist({
      userId,
      title: parsed.data.title,
      goal: input.goal,
      level: input.level,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
      stages: normalized,
    });
  }

  /**
   * Build the structured context handed to the provider. The provider is the
   * ONLY component that sees the LLM — its shape can change without touching
   * retrieval/progress logic.
   */
  private buildContext(
    input: GenerateRoadmapInput,
    candidates: CourseCandidate[],
    progress: Map<string, CourseProgress>,
    skills: string[],
  ): PlannerContext {
    return {
      goal: input.goal,
      skills,
      level: input.level,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
      candidates,
      progress,
    };
  }

  private fallbackPlan(input: GenerateRoadmapInput): AIRoadmapPlanRaw {
    return {
      title: `Learning Roadmap: ${input.goal}`,
      summary: "EduPro found no directly matching courses for this goal yet.",
      stages: [
        {
          stageNumber: 1,
          title: input.goal,
          description: "A suggested learning topic with no matching EduPro course yet.",
          goal: "Explore this topic through external resources.",
          weekStart: 1,
          weekEnd: input.durationWeeks,
          courseTitle: null,
          reason: "No matching published EduPro course available.",
          isTopic: true,
        },
      ],
    };
  }

  /**
   * Resolves each stage's `courseTitle` to a REAL course id from the supplied
   * candidate set (which came from PostgreSQL). Anything unresolved becomes a
   * suggested topic. Also enforces week-range invariants.
   */
  private resolveAndValidateStages(
    stages: AIRoadmapPlanRaw["stages"],
    candidates: CourseCandidate[],
    durationWeeks: number,
  ): NormalizedStage[] {
    // Build exact (and lowercased) title index from the REAL catalog only.
    const byTitle = new Map<string, CourseCandidate>();
    const byLower = new Map<string, CourseCandidate>();
    for (const c of candidates) {
      byTitle.set(c.title, c);
      byLower.set(c.title.toLowerCase(), c);
    }

    // Renumber strictly 1..N in the order the LLM returned (we trust ordering).
    const normalized: NormalizedStage[] = stages.map((s: AIRoadmapPlanRaw["stages"][number], i: number) => {
      const stageNumber = i + 1;
      const weekStart = Math.max(1, Math.min(s.weekStart, durationWeeks));
      const weekEnd = Math.max(1, Math.min(s.weekEnd, durationWeeks));
      const ws = Math.min(weekStart, weekEnd);
      const we = Math.max(weekStart, weekEnd);

      let courseId: string | null = null;
      let courseTitle: string | null = null;
      let courseReason: string | null = null;
      let isTopic = s.isTopic ?? false;

      if (s.courseTitle) {
        const exact = byTitle.get(s.courseTitle) ?? byLower.get(s.courseTitle.toLowerCase());
        if (exact) {
          // Re-verify it is published & enrollable (catalog only contained those).
          courseId = exact.id;
          courseTitle = exact.title;
          courseReason = s.reason ?? null;
          isTopic = false;
        } else {
          // AI invent a course that was NOT in the catalog → reject as hallucination.
          courseId = null;
          courseTitle = null;
          courseReason = "No matching EduPro course was found for this stage.";
          isTopic = true;
        }
      } else {
        // Explicit suggested topic.
        isTopic = true;
        courseReason = s.reason ?? null;
      }

      return {
        stageNumber,
        title: s.title,
        description: s.description ?? null,
        goal: s.goal ?? null,
        weekStart: ws,
        weekEnd: we,
        courseId,
        courseTitle,
        courseReason,
        isTopic,
      };
    });

    // Disallow duplicate REAL course references in consecutive order. (The same
    // course may legitimately appear once; if it appears twice we keep both,
    // but drop duplicates to avoid confusion.)
    const seen = new Set<string>();
    return normalized.filter((s) => {
      if (s.courseId) {
        if (seen.has(s.courseId)) {
          // demote the dupe to a topic so we never reference a course twice
          s.courseId = null;
          s.courseTitle = null;
          s.isTopic = true;
          s.courseReason = "Appears elsewhere in this roadmap.";
          return true;
        }
        seen.add(s.courseId);
      }
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Production repository (Prisma-backed)
// ---------------------------------------------------------------------------

export class PrismaRoadmapRepo implements RoadmapRepo {
  async findRecentDuplicate(opts: {
    userId: string;
    goal: string;
    level: RoadmapLevel;
    durationWeeks: number;
    hoursPerWeek: number;
    language: string;
  }): Promise<ExistingRoadmap | null> {
    const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const row = await prisma.roadmap.findFirst({
      where: {
        userId: opts.userId,
        goal: opts.goal,
        level: opts.level,
        durationWeeks: opts.durationWeeks,
        hoursPerWeek: opts.hoursPerWeek,
        language: opts.language,
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { stageNumber: "asc" }, include: { course: { select: { title: true } } } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      goal: row.goal,
      level: row.level as RoadmapLevel,
      durationWeeks: row.durationWeeks,
      hoursPerWeek: row.hoursPerWeek,
      language: row.language,
      createdAt: row.createdAt,
      items: row.items.map((i) => ({
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
        status: i.status,
        isTopic: i.courseId === null,
      })),
    } as ExistingRoadmap;
  }

  async claimGeneration(claim: GenerationClaim): Promise<boolean> {
    try {
      await prisma.roadmapGeneration.create({
        data: {
          userId: claim.userId,
          fingerprint: claim.fingerprint,
          status: GenerationStatus.GENERATING,
          expiresAt: claim.expiresAt,
        },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return false;
      }
      throw err;
    }
  }

  async resolveGeneration(claim: GenerationClaim): Promise<"acquired" | "busy"> {
    // 1) steal an expired GENERATING claim (crash recovery). The WHERE guard on
    // expiresAt keeps this atomic: only one stealer can win.
    const stolen = await prisma.roadmapGeneration.updateMany({
      where: {
        userId: claim.userId,
        fingerprint: claim.fingerprint,
        status: GenerationStatus.GENERATING,
        expiresAt: { lt: new Date() },
      },
      data: { expiresAt: claim.expiresAt },
    });
    if (stolen.count === 1) return "acquired";

    // 2) clear stale COMPLETED/FAILED rows (enables 24h re-generation) and re-claim.
    const cleared = await prisma.roadmapGeneration.deleteMany({
      where: {
        userId: claim.userId,
        fingerprint: claim.fingerprint,
        status: { in: [GenerationStatus.COMPLETED, GenerationStatus.FAILED] },
      },
    });
    if (cleared.count > 0) {
      const reacquired = await this.claimGeneration(claim);
      if (reacquired) return "acquired";
    }
    return "busy";
  }

  async markGeneration(
    claim: Pick<GenerationClaim, "userId" | "fingerprint">,
    status: "COMPLETED" | "FAILED",
    roadmapId?: string,
  ): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { userId: claim.userId, fingerprint: claim.fingerprint },
      data: {
        status:
          status === "COMPLETED"
            ? GenerationStatus.COMPLETED
            : GenerationStatus.FAILED,
        roadmapId: roadmapId ?? null,
      },
    });
  }

  async loadCatalog(): Promise<CourseCandidate[]> {
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        category: { select: { name: true } },
        price: true,
        studentCount: true,
        rating: true,
        modules: { select: { lessons: { select: { id: true } } } },
      },
      orderBy: { studentCount: "desc" },
      take: 100,
    });
    return courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      category: c.category?.name ?? null,
      price: c.price,
      lessonCount: c.modules.reduce((a, m) => a + m.lessons.length, 0),
      studentCount: c.studentCount,
      rating: c.rating,
    }));
  }

  async loadProgress(userId: string): Promise<Map<string, CourseProgress>> {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true, course: { select: { modules: { select: { lessons: { select: { id: true } } } } } } },
    });
    const completed = await prisma.completedLesson.findMany({
      where: { userId },
      select: { lessonId: true },
    });

    const completedLessonIds = new Set(completed.map((c) => c.lessonId));
    const map = new Map<string, CourseProgress>();

    for (const e of enrollments) {
      const totalLessons = e.course.modules.reduce((a, m) => a + m.lessons.length, 0);
      const completedCount = e.course.modules
        .flatMap((m) => m.lessons)
        .filter((l) => completedLessonIds.has(l.id)).length;
      const percent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
      map.set(e.courseId, {
        courseId: e.courseId,
        enrolled: true,
        completedLessons: completedCount,
        totalLessons,
        percent,
        completed: percent >= 100 && totalLessons > 0,
      });
    }
    return map;
  }

  async persist(roadmap: PersistRoadmap): Promise<RoadmapResult> {
    const created = await prisma.roadmap.create({
      data: {
        userId: roadmap.userId,
        title: roadmap.title,
        goal: roadmap.goal,
        level: roadmap.level,
        durationWeeks: roadmap.durationWeeks,
        hoursPerWeek: roadmap.hoursPerWeek,
        language: roadmap.language,
        items: {
          create: roadmap.stages.map((s) => ({
            stageNumber: s.stageNumber,
            title: s.title,
            description: s.description,
            goal: s.goal,
            weekStart: s.weekStart,
            weekEnd: s.weekEnd,
            courseId: s.courseId,
            courseReason: s.courseReason,
            status: s.isTopic ? RoadmapItemStatus.SUGGESTED : RoadmapItemStatus.NOT_STARTED,
            course: s.courseId ? { connect: { id: s.courseId } } : undefined,
          })),
        },
      },
      include: { items: { orderBy: { stageNumber: "asc" }, include: { course: { select: { title: true } } } } },
    });

    return {
      id: created.id,
      title: created.title,
      goal: created.goal,
      level: created.level as RoadmapLevel,
      durationWeeks: created.durationWeeks,
      hoursPerWeek: created.hoursPerWeek,
      language: created.language,
      createdAt: created.createdAt,
      isDuplicate: false,
      items: created.items.map((i) => ({
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
        status: i.status,
        isTopic: i.courseId === null,
      })),
    } as RoadmapResult;
  }
}

/** Re-export for convenience. */
export { extractSkills, rankAndFilter };
