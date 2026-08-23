/**
 * AI Personalized Learning Roadmap — server orchestration.
 *
 * Generation is asynchronous: a POST creates one job per idempotency key
 * (userId + fingerprint), an Upstash QStash worker later claims and processes
 * it. The job table's UNIQUE(userId, fingerprint) index is the idempotency
 * anchor — at most one job (and therefore one AI call) per goal fingerprint,
 * even across instances and duplicate QStash deliveries.
 *
 * The pipeline is:
 *   1. interpret the goal deterministically (analyzeGoal) — this is the
 *      baseline interpretation the AI refines later, never an allowlist.
 *   2. build the required-competency model (profile hints + explicit goal
 *      skills; additive, never a hardcoded gate).
 *   3. retrieve a bounded, deduplicated candidate set from the real catalog.
 *   4. build a prerequisite-aware context and call the AI planner (only when
 *      there is something to sequence).
 *   5. treat AI output as untrusted: validate the schema, resolve opaque keys
 *      to real courses, demote hallucinated/duplicate references, recompute
 *      weeks, and recalculate honest coverage from real course data.
 *   6. persist atomically with durable generation metadata.
 *
 * The AI never decides meaning, never invents courses, and never reports
 * coverage — those are owned by the server.
 */
import type {
  AIProvider,
  CourseCandidate,
  CourseProgress,
  PlannerContext,
} from "@/lib/ai/provider";
import {
  analyzeGoal,
  buildRequiredSkills,
  retrieveCandidatesForRequirements,
  dedupeEquivalentCourses,
  toRetrievalEvidence,
  orderByPrerequisites,
  computeSkillCoverage,
  computeRoadmapQuality,
  bestMatchQualityForCourse,
  normalizeSkillList,
  ROLE_PROFILES,
  toCatalogCoverage,
  meaningfulTitle,
  sanitizeText,
  type NormalizedGoal,
  type GoalAnalysis,
  type RequiredSkill,
  type RetrievalEvidence,
  type CoverageBreakdown,
  type MatchQuality,
  type CatalogCoverage,
} from "@/lib/ai/retrieval";
import { createHash, randomBytes } from "node:crypto";
import { interpretationSchema } from "@/lib/validation/roadmap";
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
import type { RoadmapJobPublisher } from "./roadmap.job-publisher";

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

/** A validated generation input with all optional fields resolved to their
 * runtime defaults (mirrors applyRoadmapDefaults). */
export interface ResolvedRoadmapInput {
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: "en" | "th";
  model?: string;
}

// ---------------------------------------------------------------------------
// Repository (injectable so tests can fake it)
// ---------------------------------------------------------------------------

export interface RoadmapJob {
  id: string;
  userId: string;
  /** Trusted tenant of this generation (resolved server-side at enqueue). */
  tenantId: string;
  fingerprint: string;
  goal: string | null;
  level: RoadmapLevel | null;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  language: string | null;
  model: string | null;
  /** Stored AI/deterministic goal interpretation (call #1), reused by the
   * worker so planning never re-interprets (and never doubles the AI budget). */
  interpretation: GoalAnalysis | null;
  status: JobStatus;
  roadmapId: string | null;
  expiresAt: Date;
  attemptCount: number;
  lastErrorCode: string | null;
  lastError: string | null;
  qstashMessageId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  progressStage: ProgressStage | null;
}

/** Real backend generation stages surfaced to the generating screen. Only
 * actual transitions are written — never fake timers or percentages. */
export type ProgressStage =
  | "interpreting"
  | "clarifying"
  | "retrieving"
  | "generating"
  | "validating"
  | "finalizing"
  | "completed"
  | "failed";

export interface RoadmapJobCreate {
  userId: string;
  /** MUST come from the request's trusted TenantContext. */
  tenantId: string;
  fingerprint: string;
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  model: string | null;
  interpretation?: GoalAnalysis | null;
  expiresAt: Date;
}

export interface RoadmapRepo {
  /** The full published catalog (up to 100 courses) with REAL learning
   * metadata, WITHOUT opaque keys — keys are assigned per request by the
   * service before they reach the AI. */
  /** Catalog is TENANT-scoped: the AI must never see courses of other tenants.
   * Category data remains globally shared by design. */
  loadCatalog(tenantId: string): Promise<Omit<CourseCandidate, "key">[]>;
  loadProgress(userId: string, tenantId: string): Promise<Map<string, CourseProgress>>;
  persist(roadmap: PersistRoadmap): Promise<RoadmapResult>;
  /** DB-side candidate retrieval bounded per skill and in total (the
   * CourseRetriever abstraction — swap the implementation for vector search
   * later without touching the pipeline). The repo owns coarse filtering,
   * scoring, bounding AND duplicate-collapsing, and returns the matching
   * evidence (competencies + match type) the planner and UI render. */
  retrieveCandidates(requiredSkills: RequiredSkill[], opts?: RetrieveOptions & { tenantId: string }): Promise<RetrievalEvidence[]>;
  // Job table ---------------------------------------------------------------
  getJobByFingerprint(userId: string, fingerprint: string): Promise<RoadmapJob | null>;
  getJobById(jobId: string): Promise<RoadmapJob | null>;
  /** Insert a QUEUED job. Returns null when the (userId, fingerprint) is taken. */
  createJob(job: RoadmapJobCreate): Promise<RoadmapJob | null>;
  /** Reset a FAILED job back to QUEUED (fresh accepted attempt). */
  resetFailedJob(userId: string, fingerprint: string): Promise<void>;
  /** Atomically claim QUEUED -> PROCESSING. Returns false if already claimed. */
  claimJob(jobId: string, expiresAt: Date): Promise<boolean>;
  /** Atomically steal an expired PROCESSING job. Returns false if lost. */
  stealJob(jobId: string, expiresAt: Date): Promise<boolean>;
  markJobCompleted(jobId: string, roadmapId: string): Promise<void>;
  markJobFailed(jobId: string, code: string, message: string): Promise<void>;
  /** Release a PROCESSING job back to QUEUED (retryable failure / stale lease). */
  requeueJob(jobId: string, expiresAt: Date, code: string, message: string): Promise<void>;
  setJobMessageId(jobId: string, messageId: string | null): Promise<void>;
  /** Record the real backend progress stage (honest generating screen). */
  setProgressStage(jobId: string, stage: ProgressStage): Promise<void>;
  /** Phase H: execution-time membership/tenant re-verification. Optional so
   * pure-logic test doubles may omit it; the production repo always verifies. */
  verifyTenantAccess?(userId: string, tenantId: string): Promise<boolean>;
  /** Atomically persist the roadmap AND mark the job COMPLETED — no orphan
   * roadmaps, no COMPLETED job without a roadmap, and no partial writes. */
  completeJobWithRoadmap(jobId: string, roadmap: PersistRoadmap): Promise<RoadmapResult>;
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
  skills?: string[];
  prerequisites?: string[];
  estimatedWeeks?: number;
  milestones?: string[];
  matchQuality?: MatchQuality | null;
  /** Server retrieval evidence for "Why this course?" — the competencies this
   * course demonstrably covers for this path. Never from the AI. */
  matchedCompetencies?: string[];
}

export interface RoadmapGenerationMetadata {
  /** Stable provider identifier, e.g. "nim". Null when unknown. */
  provider: string | null;
  /** Model identifier as configured. Null when unknown. */
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  /** Monotonic wall time of the provider call, in ms. */
  durationMs: number | null;
  /** When the generation finished. */
  generatedAt: Date;
  usageSource: "provider_reported" | "calculated" | "unavailable";
  /** Which job attempt (1-based) produced this roadmap. */
  attemptCount: number;
  /** How many retries happened before this attempt (attemptCount - 1). */
  retryCount: number;
}

export interface PersistRoadmap {
  userId: string;
  /** MUST be carried from the job row (server-resolved at enqueue). */
  tenantId: string;
  title: string;
  shortExplanation: string | null;
  goal: string;
  normalizedGoal: NormalizedGoal;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: "en" | "th";
  catalogCoverage: CatalogCoverage;
  missingSkills: string[];
  stages: NormalizedStage[];
  metadata: RoadmapGenerationMetadata;
  saved: boolean;
  interpretation: { goalAnalysis: GoalAnalysis; requiredSkills: RequiredSkill[] };
  confidence: number;
  assumptions: string[];
  goalCoverage: number;
  courseAvailability: number;
  coverageBreakdown: CoverageBreakdown;
  roadmapQuality: string;
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

const CATALOG_MIN_SCORE = 1;

/** Retrieval bounds honored by the CourseRetriever (per-skill and total caps). */
export interface RetrieveOptions {
  perSkill?: number;
  maxTotal?: number;
  minScore?: number;
  level?: RoadmapLevel;
}

// Opaque key prefix assigned to each candidate before it reaches the LLM.
const CANDIDATE_KEY_PREFIX = "cand";
const CANDIDATE_BUDGET_PER_SKILL = 5;
const CANDIDATE_BUDGET_MAX_TOTAL = 50;

// Shared Prisma projection for catalog rows -> CourseCandidate mapping.
const CATALOG_SELECT = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  description: true,
  category: { select: { name: true } },
  price: true,
  studentCount: true,
  rating: true,
  difficulty: true,
  skills: true,
  prerequisites: true,
  estimatedHours: true,
} as const;

type CatalogRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: { name: string } | null;
  price: number;
  studentCount: number;
  rating: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  skills: unknown;
  prerequisites: unknown;
  estimatedHours: number | null;
};

function mapCourseRow(c: CatalogRow): Omit<CourseCandidate, "key"> {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    description: c.description,
    category: c.category?.name ?? null,
    price: c.price,
    studentCount: c.studentCount,
    rating: c.rating,
    difficulty: c.difficulty,
    skills: c.skills as string[],
    prerequisites: c.prerequisites as string[],
    estimatedHours: c.estimatedHours,
  };
}

const ROADMAP_INCLUDE = {
  items: { orderBy: { stageNumber: "asc" as const }, include: { course: { select: { title: true } } } },
} as const;

/** Shared roadmap create payload (persist + atomic complete both use it so the
 * two paths never drift apart). */
function buildRoadmapCreate(roadmap: PersistRoadmap): Prisma.RoadmapUncheckedCreateInput {
  return {
    userId: roadmap.userId,
    tenantId: roadmap.tenantId,
    title: roadmap.title,
    goal: roadmap.goal,
    normalizedGoal: roadmap.normalizedGoal as never,
    level: roadmap.level,
    durationWeeks: roadmap.durationWeeks,
    hoursPerWeek: roadmap.hoursPerWeek,
    language: roadmap.language,
    catalogCoverage: roadmap.catalogCoverage,
    missingSkills: roadmap.missingSkills,
    shortExplanation: roadmap.shortExplanation,
    interpretation: roadmap.interpretation as never,
    confidence: roadmap.confidence,
    assumptions: roadmap.assumptions,
    goalCoverage: roadmap.goalCoverage,
    courseAvailability: roadmap.courseAvailability,
    coverageBreakdown: roadmap.coverageBreakdown as never,
    roadmapQuality: roadmap.roadmapQuality,
    saved: roadmap.saved,
    provider: roadmap.metadata.provider,
    model: roadmap.metadata.model,
    inputTokens: roadmap.metadata.inputTokens,
    outputTokens: roadmap.metadata.outputTokens,
    totalTokens: roadmap.metadata.totalTokens,
    durationMs: roadmap.metadata.durationMs,
    generatedAt: roadmap.metadata.generatedAt,
    usageSource: roadmap.metadata.usageSource,
    attemptCount: roadmap.metadata.attemptCount,
    retryCount: roadmap.metadata.retryCount,
    items: {
      create: roadmap.stages.map((s) => ({
        tenantId: roadmap.tenantId,
        stageNumber: s.stageNumber,
        title: s.title,
        description: s.description,
        goal: s.goal,
        weekStart: s.weekStart,
        weekEnd: s.weekEnd,
        courseReason: s.courseReason,
        isTopic: s.isTopic,
        skills: s.skills ?? [],
        prerequisites: s.prerequisites ?? [],
        milestones: s.milestones ?? [],
        estimatedWeeks: s.estimatedWeeks ?? 0,
        matchQuality: s.matchQuality ?? null,
        matchedCompetencies: s.matchedCompetencies ?? [],
        status: s.isTopic ? RoadmapItemStatus.SUGGESTED : RoadmapItemStatus.NOT_STARTED,
        course: s.courseId ? { connect: { id: s.courseId } } : undefined,
      })),
    },
  };
}

type CreatedRoadmapWithItems = {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: Date;
  items: Array<{
    id: string;
    stageNumber: number;
    title: string;
    description: string | null;
    goal: string | null;
    weekStart: number;
    weekEnd: number;
    courseId: string | null;
    course: { title: string } | null;
    courseReason: string | null;
    status: string;
  }>;
};

function mapCreatedRoadmap(created: CreatedRoadmapWithItems): RoadmapResult {
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
      status: i.status as RoadmapItemStatus,
      isTopic: i.courseId === null,
    })),
  } as RoadmapResult;
}

// PROCESSING lease: how long a job may be worked on before it is stealable.
const JOB_LEASE_MS = 10 * 60 * 1000;
// Bounded job-level retries after a retryable failure (provider 5xx/timeout,
// rate limit, invalid AI output). The provider itself also retries once.
const MAX_JOB_ATTEMPTS = 3;

export function computeFingerprint(
  userId: string,
  input: Pick<GenerateRoadmapInput, "goal" | "level" | "durationWeeks" | "hoursPerWeek" | "language" | "model" | "refresh">,
): string {
  const language = input.language ?? "en";
  const model = input.model ?? "default";
  // An explicit "regenerate" must never return the idempotent result: a fresh
  // nonce makes a new UNIQUE(userId, fingerprint) row each time. Without
  // refresh (the normal case) the fingerprint stays stable and idempotent.
  const nonce = input.refresh ? randomBytes(16).toString("hex") : "";
  return createHash("sha256")
    .update([userId, input.goal, input.level, input.durationWeeks, input.hoursPerWeek, language, model, nonce].join("\n"))
    .digest("hex");
}

export interface RoadmapServiceOptions {
  /** Lease for a PROCESSING job before it becomes stealable. */
  jobLeaseMs?: number;
  /** Maximum job-level attempts for retryable failures. */
  maxJobAttempts?: number;
}

export interface CreateJobResult {
  jobId: string;
  status: JobStatus;
  roadmapId: string | null;
  isNew: boolean;
}

export type ProcessJobOutcome =
  | { outcome: "completed"; roadmapId: string; attempt: number }
  | { outcome: "retryable"; attempt: number; code: string }
  | { outcome: "failed"; attempt: number; code: string }
  | { outcome: "noop" };

export class RoadmapService {
  private readonly jobLeaseMs: number;
  private readonly maxJobAttempts: number;

  constructor(
    private readonly provider: AIProvider,
    private readonly publisher: RoadmapJobPublisher,
    opts: RoadmapServiceOptions = {},
  ) {
    this.jobLeaseMs = opts.jobLeaseMs ?? JOB_LEASE_MS;
    this.maxJobAttempts = opts.maxJobAttempts ?? MAX_JOB_ATTEMPTS;
  }

  /**
   * Create (or return the existing) job for an idempotency key.
   *
   * - COMPLETED job -> returns the roadmapId (no new attempt, no quota hit).
   * - QUEUED/PROCESSING job -> returns it as-is (no new attempt, no quota hit);
   *   a PROCESSING job whose lease expired is re-queued + re-published so a
   *   crashed worker never strands the user.
   * - FAILED job -> reset to QUEUED (counts as ONE new accepted attempt).
   * - No job -> create QUEUED (one new accepted attempt).
   *
   * `beforeNewAttempt` (e.g. the daily quota check) is invoked exactly once,
   * BEFORE any mutation, and may throw to abort.
   */
  async createJob(
    userId: string,
    input: GenerateRoadmapInput,
    repo: RoadmapRepo,
    opts: {
      publish?: boolean;
      beforeNewAttempt?: () => Promise<void>;
      /** Pre-computed goal interpretation (call #1) to store on the job and
       * reuse in the worker. Absent → the worker derives it deterministically. */
      interpretation?: GoalAnalysis | null;
      /** Trusted tenant from TenantContext — REQUIRED, never client input. */
      tenantId: string;
    },
  ): Promise<CreateJobResult> {
    const fingerprint = computeFingerprint(userId, input);
    const publish = opts.publish ?? false;

    let job = await repo.getJobByFingerprint(userId, fingerprint);

    if (job?.status === "COMPLETED") {
      return { jobId: job.id, status: "COMPLETED", roadmapId: job.roadmapId, isNew: false };
    }

    if (job?.status === "QUEUED") {
      return { jobId: job.id, status: "QUEUED", roadmapId: null, isNew: false };
    }

    if (job?.status === "PROCESSING") {
      if (job.expiresAt >= new Date()) {
        // Live lease — a worker is (or was) handling it; return as-is.
        return { jobId: job.id, status: "PROCESSING", roadmapId: null, isNew: false };
      }
      // Stale lease: the worker crashed before finishing. Re-queue and nudge.
      await repo.requeueJob(job.id, new Date(Date.now() + this.jobLeaseMs), "stale_lease", "Re-queued after a stalled attempt.");
      if (publish) await this.publishAndRecord(repo, job.id);
      return { jobId: job.id, status: "QUEUED", roadmapId: null, isNew: false };
    }

    // FAILED, or no job yet -> this is a new accepted attempt.
    if (job?.status === "FAILED") {
      await opts.beforeNewAttempt?.();
      await repo.resetFailedJob(userId, fingerprint);
      job = await repo.getJobByFingerprint(userId, fingerprint);
    } else {
      await opts.beforeNewAttempt?.();
      job = await repo.createJob({
        userId,
        tenantId: opts.tenantId,
        fingerprint,
        goal: input.goal,
        level: input.level ?? "BEGINNER",
        durationWeeks: input.durationWeeks ?? 12,
        hoursPerWeek: input.hoursPerWeek ?? 8,
        language: input.language ?? "en",
        model: input.model ?? null,
        interpretation: opts.interpretation ?? null,
        expiresAt: new Date(Date.now() + this.jobLeaseMs),
      });
      if (!job) {
        // Lost the create race — another request created it.
        job = await repo.getJobByFingerprint(userId, fingerprint);
        if (!job) throw new ApiError(503, "Could not create the generation job. Please retry.");
        if (job.status === "COMPLETED") {
          return { jobId: job.id, status: "COMPLETED", roadmapId: job.roadmapId, isNew: false };
        }
        return { jobId: job.id, status: job.status, roadmapId: null, isNew: false };
      }
    }

    // By this point a job is guaranteed to exist (every null path returned above).
    if (!job) throw new ApiError(503, "Could not create the generation job. Please retry.");

    if (publish) await this.publishAndRecord(repo, job.id);
    return { jobId: job.id, status: "QUEUED", roadmapId: null, isNew: true };
  }

  private async publishAndRecord(repo: RoadmapRepo, jobId: string): Promise<void> {
    const messageId = await this.publisher.publishInitial(jobId);
    await repo.setJobMessageId(jobId, messageId ?? null);
  }

  /**
   * Claim and run a job (called by the QStash worker or the dev inline path).
   * Idempotent: duplicate deliveries and live-lease collisions return "noop".
   */
  async processJob(jobId: string, repo: RoadmapRepo): Promise<ProcessJobOutcome> {
    const job = await repo.getJobById(jobId);
    if (!job) {
      logJob("missing", jobId);
      return { outcome: "noop" };
    }

    // Phase H: tenant context is re-verified AT EXECUTION TIME when the repo
    // supports it (the Prisma repo always does). The tenantId in the job row
    // is server-resolved at enqueue (never client input), but membership may
    // have been revoked or the tenant deactivated while queued. Fail closed.
    if (repo.verifyTenantAccess) {
      const allowed = await repo
        .verifyTenantAccess(job.userId, job.tenantId)
        .catch(() => false);
      if (!allowed) {
        logJob("tenant_revoked", jobId, { userId: job.userId, tenantId: job.tenantId });
        await repo.markJobFailed(jobId, "tenant_access_revoked",
          "Your tenant access was removed before generation completed.");
        return { outcome: "noop" };
      }
    }

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      logJob("duplicate_delivery", jobId, { status: job.status });
      return { outcome: "noop" };
    }

    const started = performance.now();
    let attempt = job.attemptCount;

    if (job.status === "PROCESSING") {
      if (job.expiresAt >= new Date()) {
        logJob("busy", jobId, { attempt: attempt + 1 });
        return { outcome: "noop" }; // live lease
      }
      const stolen = await repo.stealJob(job.id, new Date(Date.now() + this.jobLeaseMs));
      if (!stolen) {
        logJob("steal_lost", jobId);
        return { outcome: "noop" }; // lost the steal race
      }
      attempt += 1;
      logJob("stolen", jobId, { attempt });
    } else {
      // QUEUED
      const claimed = await repo.claimJob(job.id, new Date(Date.now() + this.jobLeaseMs));
      if (!claimed) {
        logJob("claim_lost", jobId);
        return { outcome: "noop" }; // someone else claimed it
      }
      attempt += 1;
      logJob("claimed", jobId, { userId: job.userId, attempt });
    }

    const input = this.jobInput(job);
    if (!input) {
      await repo.markJobFailed(job.id, "missing_input", "The job is missing its generation input.");
      logJob("failed", jobId, { userId: job.userId, attempt, code: "missing_input" });
      return { outcome: "failed", attempt, code: "missing_input" };
    }

    // Reuse the interpretation captured at request time (call #1). Deterministic
    // fallback when the job predates interpretation storage or the AI failed.
    const analysis = job.interpretation ?? analyzeGoal(input.goal);

    try {
      const roadmap = await this.runGeneration(job.userId, job.id, job.tenantId, input, analysis, repo, attempt);
      logJob("completed", jobId, {
        userId: job.userId,
        attempt,
        durationMs: Math.round(performance.now() - started),
        roadmapId: roadmap.id,
      });
      return { outcome: "completed", roadmapId: roadmap.id, attempt };
    } catch (err) {
      const prismaError = err instanceof Prisma.PrismaClientKnownRequestError
        ? { code: err.code, meta: err.meta }
        : err instanceof Error
        ? { message: err.message, name: err.name }
        : { message: String(err) };
      logJob("error", jobId, { attempt, prismaError: JSON.stringify(prismaError), errName: err instanceof Error ? err.name : undefined });
      const { code, message, retryable } = classifyJobError(err);
      const durationMs = Math.round(performance.now() - started);
      if (retryable && attempt < this.maxJobAttempts) {
        await repo.requeueJob(job.id, new Date(Date.now() + this.jobLeaseMs), code, message);
        const msgId = await this.publisher.publishRetry(job.id);
        await repo.setJobMessageId(job.id, msgId ?? null);
        logJob("retryable", jobId, { userId: job.userId, attempt, code, durationMs });
        return { outcome: "retryable", attempt, code };
      }
      await repo.markJobFailed(job.id, code, message);
      logJob("failed", jobId, { userId: job.userId, attempt, code, durationMs });
      return { outcome: "failed", attempt, code };
    }
  }

  private jobInput(job: RoadmapJob): ResolvedRoadmapInput | null {
    if (
      job.goal == null ||
      job.level == null ||
      job.durationWeeks == null ||
      job.hoursPerWeek == null ||
      job.language == null
    ) {
      return null;
    }
    return {
      goal: job.goal,
      level: job.level,
      durationWeeks: job.durationWeeks,
      hoursPerWeek: job.hoursPerWeek,
      language: job.language === "th" ? "th" : "en",
      model: job.model ?? undefined,
    };
  }

  /**
   * The actual generation pipeline. Only runs while this worker owns the
   * PROCESSING lease for the job.
   */
  private async runGeneration(
    userId: string,
    jobId: string,
    tenantId: string,
    input: ResolvedRoadmapInput,
    analysis: GoalAnalysis,
    repo: RoadmapRepo,
    attempt: number,
  ): Promise<RoadmapResult> {
    // [1] Goal interpretation — the AI (or deterministic fallback) already
    // produced this at request time; the worker never re-interprets.
    const normalized: NormalizedGoal = {
      goal: input.goal,
      lowered: input.goal.toLowerCase(),
      tokens: input.goal.split(/\s+/),
      level: analysis.level,
      skills: analysis.skills,
    };

    // [2] Required-competency model: canonical profile hints (additive) +
    // directly-stated goal skills.
    const requiredSkills = buildRequiredSkills(analysis, ROLE_PROFILES);

    // [3] Bounded, deduplicated candidate retrieval from the real catalog (DB-side,
    // indexed) so the planner never sees equivalent duplicates or the whole
    // catalog. Keys are assigned here — the LLM only ever references these.
    // Matching evidence rides along so the planner orders by real competence
    // overlap and the UI can explain "Why this course?".
    const catalog = await repo.loadCatalog(tenantId);
    await repo.setProgressStage(jobId, "retrieving");
    const candidates: CourseCandidate[] = (
      await repo.retrieveCandidates(requiredSkills, {
        perSkill: CANDIDATE_BUDGET_PER_SKILL,
        maxTotal: CANDIDATE_BUDGET_MAX_TOTAL,
        minScore: CATALOG_MIN_SCORE,
        level: normalized.level,
        tenantId,
      })
    ).map((ev, i) => ({
      ...ev.candidate,
      key: `${CANDIDATE_KEY_PREFIX}-${i + 1}`,
      matchedCompetencies: ev.matchedCompetencies,
      matchType: ev.matchType,
    }));

    // [4] User progress lookup.
    const progress = await repo.loadProgress(userId, tenantId);

    // [5] Prerequisite-aware baseline ordering (the AI may personalize; the
    // server re-validates afterward regardless).
    const orderMap = new Map(
      orderByPrerequisites(candidates).map((b) => [b.key, b.order] as const),
    );
    const orderedCandidates = [...candidates].sort(
      (a, b) => (orderMap.get(a.key) ?? 0) - (orderMap.get(b.key) ?? 0),
    );

    // [6] AI call — only when there is something to sequence.
    const started = performance.now();
    await repo.setProgressStage(jobId, "generating");
    const generated = candidates.length
      ? await this.provider.generateRoadmap(
          this.buildContext(input, orderedCandidates, progress, analysis, requiredSkills),
        )
      : null;
    const durationMs = candidates.length ? Math.round(performance.now() - started) : null;

    let stages: NormalizedStage[];
    let title: string;
    let summary: string | null;

    if (!generated) {
      // [7] Nothing to sequence: build the unavailable path directly (never a
      // fake generic topic) and skip the AI output pipeline entirely.
      stages = [];
      title = foundationsTitle(normalized);
      summary =
        "EduPro has no courses that meaningfully match this goal yet. The path is saved as unavailable and will improve as the catalog grows.";
    } else {
      // [8] Zod validation of AI output (untrusted data).
      await repo.setProgressStage(jobId, "validating");
      const parsed = aiRoadmapPlanSchema.safeParse(generated);
      if (!parsed.success) {
        throw new ApiError(502, "The AI output did not pass validation. Retrying.");
      }

      // [9] Resolve opaque candidate keys against the REAL catalog
      // (hallucination guard) and enforce week invariants.
      const resolved = this.resolveAndValidateStages(parsed.data.stages, candidates, input.durationWeeks);

      // [9b] Prerequisite ordering: a course whose prerequisites are taught by
      // another course must come AFTER it. The AI's returned order is NOT
      // trusted — the server reorders (or demotes on a cycle) from real course
      // skill data.
      const ordered = this.enforcePrerequisiteOrder(resolved, candidates);

      // [10] Demote duplicate course references, renumber and recompute weeks
      // from real course data, clamped to the requested duration.
      const withoutDuplicates = this.finalizeStages(ordered, candidates, input.durationWeeks, 8, input.hoursPerWeek);

      // [11] Per-stage match quality is server-computed (never from the AI).
      const byCourseId = new Map(candidates.map((c) => [c.id, c]));
      stages = withoutDuplicates.map((s) => ({
        ...s,
        matchQuality: s.courseId
          ? bestMatchQualityForCourse(byCourseId.get(s.courseId) ?? null, requiredSkills)
          : null,
      }));

      // [12] Meaningful title with a safe fallback derived from the goal.
      title = meaningfulTitle(parsed.data.title, input.goal, normalized);
      summary = parsed.data.summary ? sanitizeText(parsed.data.summary) : null;
    }

    // [13] HONEST coverage against the REAL final path + the real catalog.
    // Never invented by the AI. Shared by the available and unavailable paths.
    await repo.setProgressStage(jobId, "finalizing");
    const finalBreakdown = computeSkillCoverage({
      requiredSkills,
      catalog,
      matchedCourseIds: stages.filter((s) => s.courseId).map((s) => s.courseId!),
    });
    const coverage = toCatalogCoverage(finalBreakdown.goalCoverage);
    const missingSkills = finalBreakdown.skills
      .filter((s) => s.status === "unavailable")
      .map((s) => s.skill);

    // [14] Durable generation metadata.
    const metadata: RoadmapGenerationMetadata = {
      provider: generated?.usage?.provider ?? null,
      model: generated?.usage?.model ?? null,
      inputTokens: generated?.usage?.inputTokens ?? null,
      outputTokens: generated?.usage?.outputTokens ?? null,
      totalTokens: generated?.usage?.totalTokens ?? null,
      durationMs,
      generatedAt: new Date(),
      usageSource: generated?.usage?.usageSource ?? "unavailable",
      attemptCount: attempt,
      retryCount: Math.max(0, attempt - 1),
    };

    return repo.completeJobWithRoadmap(jobId, {
      userId,
      tenantId,
      title,
      shortExplanation: summary,
      goal: input.goal,
      normalizedGoal: normalized,
      level: normalized.level,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
      catalogCoverage: coverage,
      missingSkills,
      stages,
      metadata,
      saved: false,
      interpretation: { goalAnalysis: analysis, requiredSkills },
      confidence: analysis.confidence,
      assumptions: analysis.assumptions,
      goalCoverage: finalBreakdown.goalCoverage,
      courseAvailability: finalBreakdown.courseAvailability,
      coverageBreakdown: finalBreakdown,
      roadmapQuality: computeRoadmapQuality(finalBreakdown),
    });
  }

  /**
   * Build the structured context handed to the provider. The provider is the
   * ONLY component that sees the LLM — its shape can change without touching
   * retrieval/progress logic.
   */
  private buildContext(
    input: ResolvedRoadmapInput,
    candidates: CourseCandidate[],
    progress: Map<string, CourseProgress>,
    analysis: GoalAnalysis,
    requiredSkills: RequiredSkill[],
  ): PlannerContext {
    // Honest preview of what the offered candidate set can cover.
    const preview = computeSkillCoverage({
      requiredSkills,
      catalog: candidates,
      matchedCourseIds: candidates.map((c) => c.id),
    });
    return {
      goal: input.goal,
      normalizedGoal: {
        role: analysis.role,
        skills: analysis.skills,
        level: input.level,
        outcome: analysis.role ? `Become a ${analysis.role}.` : input.goal,
      },
      skills: analysis.skills,
      level: input.level,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
      candidates,
      progress,
      interpretation: {
        role: analysis.role,
        domain: analysis.domain,
        confidence: analysis.confidence,
        assumptions: analysis.assumptions,
        requiredSkills,
        coveragePreview: {
          goalCoverage: preview.goalCoverage,
          courseAvailability: preview.courseAvailability,
          skills: preview.skills.map((s) => ({
            skill: s.skill,
            importance: s.importance,
            status: s.status,
            reason: s.reason,
            quality: s.quality,
            matchedCourseIds: s.matchedCourseIds,
            catalogCourseIds: s.catalogCourseIds,
          })),
        },
      },
    };
  }

  /**
   * Resolves each stage's `courseKey` to a REAL course id from the supplied
   * candidate set (which came from PostgreSQL). Because the key is opaque and
   * unique, this is deterministic even when titles collide, are renamed, or are
   * hallucinated by the model. Any unknown/absent key becomes a suggested topic.
   * Also enforces week-range invariants and demotes duplicate course references.
   */
  private resolveAndValidateStages(
    stages: AIRoadmapPlanRaw["stages"],
    candidates: CourseCandidate[],
    durationWeeks: number,
  ): NormalizedStage[] {
    // Build a key index from the REAL catalog only.
    const byKey = new Map<string, CourseCandidate>();
    for (const c of candidates) byKey.set(c.key, c);

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
      let prerequisites: string[] | undefined;
      let matchedCompetencies: string[] | undefined;
      let isTopic = s.isTopic ?? false;

      if (s.courseKey) {
        const match = byKey.get(s.courseKey);
        if (match) {
          // Resolved to a real, published, enrollable course row.
          courseId = match.id;
          courseTitle = match.title;
          courseReason = s.reason ?? null;
          prerequisites = match.prerequisites ?? [];
          matchedCompetencies = match.matchedCompetencies ?? [];
          isTopic = false;
        } else {
          // AI referenced a key that was NOT in the catalog → reject as hallucination.
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
        // Stage competencies are normalized through the real skill vocabulary:
        // hallucinated skill names never reach the persisted roadmap.
        skills: normalizeSkillList(s.skills ?? []),
        prerequisites,
        matchedCompetencies,
        milestones: s.milestones ?? [],
      };
    });

    // Disallow duplicate REAL course references. The same course appearing more
    // than once is demoted to a topic so we never reference a course twice.
    const seen = new Set<string>();
    return normalized.filter((s) => {
      if (s.courseId) {
        if (seen.has(s.courseId)) {
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

  /**
   * Enforces prerequisite ordering from REAL course data. For every stage that
   * references a course, each prerequisite of that course must be covered by a
   * stage that comes earlier (a course teaching the prerequisite skill). The
   * AI's returned order is untrusted; a stable topological sort reorders stages
   * so prerequisite courses precede their dependents. A prerequisite cycle
   * (A needs what B teaches and B needs what A teaches) cannot be satisfied —
   * the involved stages are demoted to topics rather than left in a broken
   * order.
   */
  private enforcePrerequisiteOrder(
    resolved: NormalizedStage[],
    candidates: CourseCandidate[],
  ): NormalizedStage[] {
    const n = resolved.length;
    const byCourseId = new Map(candidates.map((c) => [c.id, c]));
    const teaches = new Map<string, Set<string>>();
    for (const [cid, c] of byCourseId) {
      teaches.set(cid, new Set((c.skills ?? []).map((s) => s.toLowerCase())));
    }

    // Edge `before -> after` means the stage at index `before` teaches a
    // prerequisite of the course referenced at index `after`.
    const adj: number[][] = Array.from({ length: n }, () => []);
    const indeg = new Array<number>(n).fill(0);
    for (const [i, s] of resolved.entries()) {
      if (!s.courseId) continue;
      for (const prereq of s.prerequisites ?? []) {
        const p = prereq.toLowerCase();
        for (const [j, other] of resolved.entries()) {
          if (!other.courseId || other.courseId === s.courseId) continue;
          if (teaches.get(other.courseId)?.has(p)) {
            adj[j]!.push(i);
            indeg[i]! += 1;
          }
        }
      }
    }

    // Stable Kahn's algorithm: ties keep their original relative order so an
    // already-correct plan is never needlessly reshuffled.
    const queue: number[] = [];
    for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
    const order: number[] = [];
    while (queue.length) {
      const u = queue.shift()!;
      order.push(u);
      for (const v of adj[u]!) {
        indeg[v]! -= 1;
        if (indeg[v] === 0) queue.push(v);
      }
    }

    if (order.length === n) {
      const reordered = order.map((i) => ({ ...resolved[i]!, stageNumber: order.indexOf(i) + 1 }));
      return reordered;
    }

    // A cycle exists: leftover stages can't be ordered honestly, so demote them
    // to topics with an explicit reason instead of presenting a broken order.
    const inOrder = new Set(order);
    const leftover = resolved
      .map((s, i) => [i, s] as const)
      .filter(([i]) => !inOrder.has(i))
      .map(([, s]) => ({
        ...s,
        stageNumber: -1,
        courseId: null,
        courseTitle: null,
        isTopic: true,
        courseReason: "Course prerequisites are not covered earlier in this path.",
      }));
    const reordered = [...order.map((i) => ({ ...resolved[i]!, stageNumber: -1 })), ...leftover];
    return reordered.map((s, idx) => ({ ...s, stageNumber: idx + 1 }));
  }

  /**
   * Renumbers stages 1..N and recomputes week ranges from real course hours
   * (estimatedWeeks = hours / hoursPerWeek) when available; otherwise the
   * remaining duration is split evenly. Everything is clamped to the requested
   * duration so the AI can never overflow the schedule.
   */
  private finalizeStages(
    resolved: NormalizedStage[],
    candidates: CourseCandidate[],
    durationWeeks: number,
    maxStages: number,
    hoursPerWeek: number,
  ): NormalizedStage[] {
    const byCourseId = new Map(candidates.map((c) => [c.id, c]));

    // Real-hours-derived weeks per course stage (0 = unknown → even split).
    const courseStages = resolved.filter((s) => s.courseId);
    const courseWeeks = courseStages.map((s) => {
      const hours = byCourseId.get(s.courseId!)?.estimatedHours;
      return hours && hoursPerWeek > 0 ? Math.max(1, Math.round(hours / hoursPerWeek)) : 0;
    });
    const fixedTotal = courseWeeks.reduce((a, b) => a + b, 0);
    const noHoursCount = courseWeeks.filter((w) => w === 0).length;
    const remaining = Math.max(0, durationWeeks - fixedTotal);
    const evenWeek = noHoursCount > 0 ? Math.max(1, Math.floor(remaining / noHoursCount)) : 1;

    const weekForCourse = new Map<string, number>();
    for (const s of courseStages) {
      const hours = byCourseId.get(s.courseId!)?.estimatedHours;
      weekForCourse.set(
        s.courseId!,
        hours && hoursPerWeek > 0 ? Math.max(1, Math.round(hours / hoursPerWeek)) : evenWeek,
      );
    }

    let cursor = 1;
    const numbered: NormalizedStage[] = [];
    for (const [i, s] of resolved.entries()) {
      const weeks = s.courseId ? (weekForCourse.get(s.courseId) ?? evenWeek) : evenWeek;
      const ws = Math.max(1, Math.min(cursor, durationWeeks));
      const we = Math.min(cursor + Math.max(1, weeks) - 1, durationWeeks);
      cursor = we + 1;
      numbered.push({
        ...s,
        stageNumber: i + 1,
        weekStart: ws,
        weekEnd: we,
        estimatedWeeks: we - ws + 1,
      });
    }

    return numbered.slice(0, maxStages);
  }
}

/** Humanized fallback title for the unavailable path (never fabricated by AI). */
function foundationsTitle(normalized: NormalizedGoal): string {
  const base = normalized.goal
    .replace(/^(i want to|i'd like to|i would like to|learn|become a|become an|become)\s+/i, "")
    .trim();
  const title = base || "Learning Path";
  const capitalized = title
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${capitalized} Foundations`;
}

function classifyJobError(err: unknown): { code: string; message: string; retryable: boolean } {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) {
      return { code: "provider_rate_limited", message: "The AI provider is rate limited.", retryable: true };
    }
    if (err.statusCode === 502) {
      return { code: "provider_unavailable", message: "The AI provider was temporarily unavailable.", retryable: true };
    }
    if (err.statusCode === 400) {
      return { code: "provider_rejected", message: "The AI provider rejected the request.", retryable: false };
    }
    return { code: "generation_failed", message: err.message.slice(0, 200), retryable: false };
  }
  return { code: "internal", message: "Unexpected generation error.", retryable: false };
}

/** Structured, JSON-line logging. Never log stack traces, provider response
 * bodies, or anything user-sensitive. */
function logJob(event: string, jobId: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event: `roadmap.job.${event}`, jobId, ...fields }));
}

// ---------------------------------------------------------------------------
// Production repository (Prisma-backed)
// ---------------------------------------------------------------------------

export class PrismaRoadmapRepo implements RoadmapRepo {
  /** Execution-time fail-closed check: active membership on an active tenant. */
  async verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    const m = await prisma.tenantMembership.findFirst({
      where: { userId, tenantId, tenant: { isActive: true } },
      select: { id: true },
    });
    if (!m) return false;
    const banned = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });
    return !!banned && !banned.isBanned;
  }

  async getJobByFingerprint(userId: string, fingerprint: string): Promise<RoadmapJob | null> {
    const row = await prisma.roadmapGeneration.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });
    return row ? this.toJob(row) : null;
  }

  async getJobById(jobId: string): Promise<RoadmapJob | null> {
    const row = await prisma.roadmapGeneration.findUnique({ where: { id: jobId } });
    return row ? this.toJob(row) : null;
  }

  async createJob(job: RoadmapJobCreate): Promise<RoadmapJob | null> {
    try {
      const row = await prisma.roadmapGeneration.create({
        data: {
          userId: job.userId,
          tenantId: job.tenantId,
          fingerprint: job.fingerprint,
          goal: job.goal,
          level: job.level,
          durationWeeks: job.durationWeeks,
          hoursPerWeek: job.hoursPerWeek,
          language: job.language,
          model: job.model,
          interpretation: job.interpretation ? (job.interpretation as unknown as Prisma.InputJsonValue) : undefined,
          status: GenerationStatus.QUEUED,
          progressStage: "interpreting",
          expiresAt: job.expiresAt,
          attemptCount: 0,
        },
      });
      return this.toJob(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return null;
      }
      throw err;
    }
  }

  async resetFailedJob(userId: string, fingerprint: string): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { userId, fingerprint, status: GenerationStatus.FAILED },
      data: {
        status: GenerationStatus.QUEUED,
        attemptCount: 0,
        lastErrorCode: null,
        lastError: null,
        failedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
  }

  async claimJob(jobId: string, expiresAt: Date): Promise<boolean> {
    const res = await prisma.roadmapGeneration.updateMany({
      where: { id: jobId, status: GenerationStatus.QUEUED },
      data: {
        status: GenerationStatus.PROCESSING,
        expiresAt,
        attemptCount: { increment: 1 },
        startedAt: new Date(),
        lastErrorCode: null,
        lastError: null,
      },
    });
    return res.count === 1;
  }

  async stealJob(jobId: string, expiresAt: Date): Promise<boolean> {
    const res = await prisma.roadmapGeneration.updateMany({
      where: { id: jobId, status: GenerationStatus.PROCESSING, expiresAt: { lt: new Date() } },
      data: {
        status: GenerationStatus.PROCESSING,
        expiresAt,
        attemptCount: { increment: 1 },
        startedAt: new Date(),
      },
    });
    return res.count === 1;
  }

  async markJobCompleted(jobId: string, roadmapId: string): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { id: jobId },
      data: {
        status: GenerationStatus.COMPLETED,
        roadmapId,
        completedAt: new Date(),
        lastErrorCode: null,
        lastError: null,
      },
    });
  }

  async markJobFailed(jobId: string, code: string, message: string): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { id: jobId },
      data: {
        status: GenerationStatus.FAILED,
        progressStage: "failed",
        lastErrorCode: code,
        lastError: message,
        failedAt: new Date(),
      },
    });
  }

  async requeueJob(jobId: string, expiresAt: Date, code: string, message: string): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { id: jobId },
      data: {
        status: GenerationStatus.QUEUED,
        expiresAt,
        lastErrorCode: code,
        lastError: message,
        startedAt: null,
      },
    });
  }

  async setJobMessageId(jobId: string, messageId: string | null): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { id: jobId },
      data: { qstashMessageId: messageId },
    });
  }

  async setProgressStage(jobId: string, stage: ProgressStage): Promise<void> {
    await prisma.roadmapGeneration.updateMany({
      where: { id: jobId },
      data: { progressStage: stage },
    });
  }

  private toJob(row: {
    id: string;
    userId: string;
    tenantId: string;
    fingerprint: string;
    goal: string | null;
    level: string | null;
    durationWeeks: number | null;
    hoursPerWeek: number | null;
    language: string | null;
    model: string | null;
    interpretation: unknown;
    status: string;
    roadmapId: string | null;
    expiresAt: Date;
    attemptCount: number;
    lastErrorCode: string | null;
    lastError: string | null;
    qstashMessageId: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    createdAt: Date;
    progressStage: string | null;
  }): RoadmapJob {
    return {
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      fingerprint: row.fingerprint,
      goal: row.goal,
      level: row.level as RoadmapLevel | null,
      durationWeeks: row.durationWeeks,
      hoursPerWeek: row.hoursPerWeek,
      language: row.language,
      model: row.model,
      interpretation: (row.interpretation as GoalAnalysis) ?? null,
      status: row.status as JobStatus,
      roadmapId: row.roadmapId,
      expiresAt: row.expiresAt,
      attemptCount: row.attemptCount,
      lastErrorCode: row.lastErrorCode,
      lastError: row.lastError,
      qstashMessageId: row.qstashMessageId,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
      createdAt: row.createdAt,
      progressStage: row.progressStage as ProgressStage | null,
    };
  }

  async loadCatalog(tenantId: string): Promise<Omit<CourseCandidate, "key">[]> {
    const courses = await prisma.course.findMany({
      where: { isPublished: true, tenantId },
      select: CATALOG_SELECT,
      orderBy: { studentCount: "desc" },
      take: 100,
    });
    return courses.map(mapCourseRow);
  }

  async retrieveCandidates(
    requiredSkills: RequiredSkill[],
    opts: RetrieveOptions & { tenantId: string } = { tenantId: "" },
  ): Promise<RetrievalEvidence[]> {
    if (requiredSkills.length === 0 || !opts.tenantId) return [];
    const perSkill = opts.perSkill ?? CANDIDATE_BUDGET_PER_SKILL;
    const maxTotal = opts.maxTotal ?? CANDIDATE_BUDGET_MAX_TOTAL;
    const minScore = opts.minScore ?? CATALOG_MIN_SCORE;

    // DB-side coarse filter (GIN-indexed JSONB array-contains + text match).
    // The expensive full-catalog scan lives here, not in the app. The bounded
    // in-memory scorer then ranks exactly as the fake path does, so both
    // implementations agree on semantics.
    const ors: Prisma.CourseWhereInput[] = [];
    for (const req of requiredSkills) {
      const skill = req.skill.toLowerCase();
      ors.push(
        { skills: { array_contains: [req.skill] } },
        { title: { contains: skill, mode: "insensitive" } },
        { category: { is: { name: { contains: skill, mode: "insensitive" } } } },
      );
    }

    const rows = await prisma.course.findMany({
      where: {
        // Same published-catalog contract as loadCatalog (which powers the
        // coverage numbers) — coarse filter only, scoring happens below.
        // TENANT-SCOPED: candidates never cross tenants.
        isPublished: true,
        tenantId: opts.tenantId,
        OR: ors,
      },
      select: CATALOG_SELECT,
      orderBy: [{ studentCount: "desc" }, { id: "asc" }],
      take: Math.min(500, Math.max(perSkill * requiredSkills.length * 3, 250)),
    });

    const subset = rows.map(mapCourseRow);
    return dedupeEquivalentCourses(
      retrieveCandidatesForRequirements(subset, requiredSkills, { perSkill, maxTotal, minScore }),
    ).map((r) => toRetrievalEvidence(r, requiredSkills));
  }

  async loadProgress(userId: string, tenantId: string): Promise<Map<string, CourseProgress>> {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, tenantId },
      select: { courseId: true, course: { select: { modules: { select: { lessons: { select: { id: true } } } } } } },
    });
    const completed = await prisma.completedLesson.findMany({
      where: { userId, tenantId },
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
      data: buildRoadmapCreate(roadmap),
      include: ROADMAP_INCLUDE,
    });

    return mapCreatedRoadmap(created);
  }

  async completeJobWithRoadmap(jobId: string, roadmap: PersistRoadmap): Promise<RoadmapResult> {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.roadmap.create({
        data: buildRoadmapCreate(roadmap),
        include: ROADMAP_INCLUDE,
      });
      await tx.roadmapGeneration.update({
        where: { id: jobId },
        data: {
          status: GenerationStatus.COMPLETED,
          roadmapId: created.id,
          progressStage: "completed",
          completedAt: new Date(),
        },
      });
      return created;
    });

    return mapCreatedRoadmap(created);
  }
}

/**
 * Interpret a goal for a request (call #1 of the 2-call budget) with a
 * hard deterministic fallback. The AI interpretation is zod-validated and used
 * only when it parses cleanly; any absence/failure/timeout degrades to
 * `analyzeGoal` so goal understanding NEVER blocks roadmap generation.
 */
export async function interpretGoalWithFallback(
  provider: AIProvider,
  goal: string,
  language: "en" | "th",
): Promise<GoalAnalysis> {
  if (provider.interpretGoal) {
    try {
      const raw = await provider.interpretGoal({ goal, language });
      const parsed = interpretationSchema.safeParse(raw);
      if (parsed.success) {
        const v = parsed.data;
        return {
          role: v.role ?? null,
          roleId: v.roleId ?? null,
          roleSource: v.roleSource,
          roleConfidence: v.roleConfidence,
          domain: v.domain ?? null,
          domainConfidence: v.domainConfidence,
          skills: v.skills,
          knownSkills: v.knownSkills,
          level: v.level,
          confidence: v.confidence,
          assumptions: v.assumptions,
          target: v.target ?? null,
          outcome: v.outcome ?? null,
          competencies: v.competencies ?? [],
          ambiguity: v.ambiguity ?? { isAmbiguous: false, gaps: [], reason: null },
        };
      }
      console.log(JSON.stringify({ event: "roadmap.interpretation.invalid", goal: goal.slice(0, 60) }));
    } catch (err) {
      console.log(
        JSON.stringify({
          event: "roadmap.interpretation.fallback",
          reason: err instanceof Error ? err.message.slice(0, 120) : String(err),
        }),
      );
    }
  }
  return analyzeGoal(goal);
}