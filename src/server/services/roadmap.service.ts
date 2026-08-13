/**
 * AI Personalized Learning Roadmap — server orchestration.
 *
 * Generation is asynchronous: a POST creates one job per idempotency key
 * (userId + fingerprint), an Upstash QStash worker later claims and processes
 * it. The job table's UNIQUE(userId, fingerprint) index is the idempotency
 * anchor — at most one job (and therefore one AI call) per goal fingerprint,
 * even across instances and duplicate QStash deliveries.
 *
 * Pipeline (executed only by the job owner while holding the PROCESSING lease):
 *   1. course retrieval (real, published only)
 *   2. relevance ranking (deterministic)
 *   3. user progress lookup (existing Enrollment/CompletedLesson)
 *   4. LLM call
 *   5. Zod validation of AI output
 *   6. course-resolution against the REAL catalog (hallucination guard)
 *   7. persist
 *
 * The AI never writes to the DB, never decides IDs, and never sees user
 * identity beyond "this course is completed / in-progress".
 *
 * Job state machine:
 *   QUEUED    -> PROCESSING -> COMPLETED
 *   QUEUED    -> PROCESSING -> FAILED
 *   PROCESSING -> QUEUED    (expired lease re-queued by a new POST, or retryable
 *                           failure re-published by the worker)
 *   PROCESSING -> FAILED    (non-retryable failure or attempts exhausted)
 *   COMPLETED -> COMPLETED  (duplicate delivery / POST is a no-op)
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
import type { RoadmapJobPublisher } from "./roadmap.job-publisher";

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

// ---------------------------------------------------------------------------
// Repository (injectable so tests can fake it)
// ---------------------------------------------------------------------------

export interface RoadmapJob {
  id: string;
  userId: string;
  fingerprint: string;
  goal: string | null;
  level: RoadmapLevel | null;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  language: string | null;
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
}

export interface RoadmapJobCreate {
  userId: string;
  fingerprint: string;
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  expiresAt: Date;
}

export interface RoadmapRepo {
  /** The full published catalog (up to 100 courses), WITHOUT opaque keys —
   * keys are assigned per request by the service before they reach the AI. */
  loadCatalog(): Promise<Omit<CourseCandidate, "key">[]>;
  loadProgress(userId: string): Promise<Map<string, CourseProgress>>;
  persist(roadmap: PersistRoadmap): Promise<RoadmapResult>;
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

export interface RoadmapGenerationMetadata {
  /** Stable provider identifier, e.g. "gemini". Null when unknown. */
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
  title: string;
  goal: string;
  level: RoadmapLevel;
  durationWeeks: number;
  hoursPerWeek: number;
  language: "en" | "th";
  stages: NormalizedStage[];
  metadata: RoadmapGenerationMetadata;
  saved: boolean;
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

// The full scored catalog is offered to the planner (loadCatalog returns up to
// 100 published courses). No arbitrary top-N cap: a lower-ranked but relevant
// course must still be reachable by the LLM. `minScore` only excludes courses
// that share no keyword with the goal, keeping the prompt focused.
const CATALOG_MIN_SCORE = 1;

// Opaque key prefix assigned to each candidate before it reaches the LLM.
const CANDIDATE_KEY_PREFIX = "cand";

// PROCESSING lease: how long a job may be worked on before it is stealable.
const JOB_LEASE_MS = 10 * 60 * 1000;
// Bounded job-level retries after a retryable failure (provider 5xx/timeout,
// rate limit, invalid AI output). The provider itself also retries once.
const MAX_JOB_ATTEMPTS = 3;

export function computeFingerprint(
  userId: string,
  input: Pick<GenerateRoadmapInput, "goal" | "level" | "durationWeeks" | "hoursPerWeek" | "language">,
): string {
  const language = input.language ?? "en";
  return createHash("sha256")
    .update([userId, input.goal, input.level, input.durationWeeks, input.hoursPerWeek, language].join("\n"))
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
    opts: { publish?: boolean; beforeNewAttempt?: () => Promise<void> } = {},
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
        fingerprint,
        goal: input.goal,
        level: input.level,
        durationWeeks: input.durationWeeks,
        hoursPerWeek: input.hoursPerWeek,
        language: input.language ?? "en",
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

    try {
      const roadmap = await this.runGeneration(job.userId, input, repo, attempt);
      await repo.markJobCompleted(job.id, roadmap.id);
      logJob("completed", jobId, {
        userId: job.userId,
        attempt,
        durationMs: Math.round(performance.now() - started),
        roadmapId: roadmap.id,
      });
      return { outcome: "completed", roadmapId: roadmap.id, attempt };
    } catch (err) {
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

  private jobInput(job: RoadmapJob): GenerateRoadmapInput | null {
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
    };
  }

  /**
   * The actual generation pipeline. Only runs while this worker owns the
   * PROCESSING lease for the job.
   */
  private async runGeneration(
    userId: string,
    input: GenerateRoadmapInput,
    repo: RoadmapRepo,
    attempt: number,
  ): Promise<RoadmapResult> {
    // [1] course retrieval + [2] relevance ranking (full scored catalog)
    const catalog = await repo.loadCatalog();
    const ranked = rankAndFilter(catalog, extractSkills(input.goal), {
      limit: catalog.length, // no top-N cap: the whole scored catalog is offered
      minScore: CATALOG_MIN_SCORE,
    });
    // Assign opaque, deterministic per-request keys. The LLM references these
    // keys — never title text — so resolution is immune to duplicate/renamed
    // titles and hallucinated strings.
    const candidates: CourseCandidate[] = ranked.map((r, i) => ({
      ...r.candidate,
      key: `${CANDIDATE_KEY_PREFIX}-${i + 1}`,
    }));

    // [3] user progress lookup
    const progress = await repo.loadProgress(userId);

    // [4] LLM call (only if there is something to sequence). Duration uses a
    // monotonic clock; usage metadata is captured from the provider result.
    const skills = extractSkills(input.goal);
    const started = performance.now();
    const generated = candidates.length
      ? await this.provider.generateRoadmap(this.buildContext(input, candidates, progress, skills))
      : null;
    const durationMs = candidates.length ? Math.round(performance.now() - started) : null;
    const plan: AIRoadmapPlanRaw = generated ?? this.fallbackPlan(input);
    const usage = generated?.usage ?? null;

    // [5] Zod validation of AI output
    const parsed = aiRoadmapPlanSchema.safeParse(plan);
    if (!parsed.success) {
      throw new ApiError(502, "The AI output did not pass validation. Retrying.");
    }

    // [6] resolve candidate keys against the REAL catalog (hallucination guard)
    const normalized = this.resolveAndValidateStages(
      parsed.data.stages,
      candidates,
      input.durationWeeks,
    );

    // [7] persist, together with durable generation metadata.
    const metadata: RoadmapGenerationMetadata = {
      provider: usage?.provider ?? null,
      model: usage?.model ?? null,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      durationMs,
      generatedAt: new Date(),
      usageSource: usage?.usageSource ?? "unavailable",
      attemptCount: attempt,
      retryCount: Math.max(0, attempt - 1),
    };
    return repo.persist({
      userId,
      title: parsed.data.title,
      goal: input.goal,
      level: input.level,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
      stages: normalized,
      metadata,
      // Persist as an unsaved draft; the user reviews it before saving.
      saved: false,
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
          courseKey: null,
          reason: "No matching published EduPro course available.",
          isTopic: true,
        },
      ],
    };
  }

  /**
   * Resolves each stage's `courseKey` to a REAL course id from the supplied
   * candidate set (which came from PostgreSQL). Because the key is opaque and
   * unique, this is deterministic even when titles collide, are renamed, or are
   * hallucinated by the model. Any unknown/absent key becomes a suggested topic.
   * Also enforces week-range invariants.
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
      let isTopic = s.isTopic ?? false;

      if (s.courseKey) {
        const match = byKey.get(s.courseKey);
        if (match) {
          // Resolved to a real, published, enrollable course row.
          courseId = match.id;
          courseTitle = match.title;
          courseReason = s.reason ?? null;
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
          fingerprint: job.fingerprint,
          goal: job.goal,
          level: job.level,
          durationWeeks: job.durationWeeks,
          hoursPerWeek: job.hoursPerWeek,
          language: job.language,
          status: GenerationStatus.QUEUED,
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
      data: { status: GenerationStatus.FAILED, lastErrorCode: code, lastError: message, failedAt: new Date() },
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

  private toJob(row: {
    id: string;
    userId: string;
    fingerprint: string;
    goal: string | null;
    level: string | null;
    durationWeeks: number | null;
    hoursPerWeek: number | null;
    language: string | null;
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
  }): RoadmapJob {
    return {
      id: row.id,
      userId: row.userId,
      fingerprint: row.fingerprint,
      goal: row.goal,
      level: row.level as RoadmapLevel | null,
      durationWeeks: row.durationWeeks,
      hoursPerWeek: row.hoursPerWeek,
      language: row.language,
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
    };
  }

  async loadCatalog(): Promise<Omit<CourseCandidate, "key">[]> {
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
            stageNumber: s.stageNumber,
            title: s.title,
            description: s.description,
            goal: s.goal,
            weekStart: s.weekStart,
            weekEnd: s.weekEnd,
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
