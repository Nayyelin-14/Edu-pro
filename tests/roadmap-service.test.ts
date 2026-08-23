import { test, describe } from "node:test";
import assert from "node:assert";
import { RoadmapService, computeFingerprint, interpretGoalWithFallback } from "@/server/services/roadmap.service";
import type { RoadmapRepo, RoadmapJob, RoadmapJobCreate, RoadmapResult, RoadmapServiceOptions, PersistRoadmap, ProgressStage } from "@/server/services/roadmap.service";
import type { RoadmapJobPublisher } from "@/server/services/roadmap.job-publisher";
import { createMockProvider, createFailingMockProvider } from "@/lib/ai/mock";
import type { GenerateRoadmapInput } from "@/lib/validation/roadmap";
import type { CourseCandidate, CourseProgress, AIProvider, PlannerContext, AIRoadmapPlan, GoalInterpretation } from "@/lib/ai/provider";
import type { GoalAnalysis } from "@/lib/ai/retrieval";
import { retrieveCandidatesForRequirements, dedupeEquivalentCourses, toRetrievalEvidence } from "@/lib/ai/retrieval";
import { ApiError } from "@/lib/errors";

function makeCandidate(overrides: Partial<CourseCandidate> = {}): CourseCandidate {
  return {
    key: `cand-${Math.random()}`,
    id: `c${Math.random()}`,
    slug: `course-${Math.random()}`,
    title: "Test Course",
    subtitle: null,
    description: "Test description",
    category: "Backend",
    price: 0,
    studentCount: 50,
    rating: 4.0,
    ...overrides,
  };
}

function makeProgress(entries: Array<{ courseId: string; completed: boolean }>) {
  const map = new Map<string, CourseProgress>();
  for (const e of entries) {
    map.set(e.courseId, {
      courseId: e.courseId,
      enrolled: true,
      completedLessons: e.completed ? 10 : 5,
      totalLessons: 10,
      percent: e.completed ? 100 : 50,
      completed: e.completed,
    });
  }
  return map;
}

function makeInput(overrides: Partial<GenerateRoadmapInput> = {}): GenerateRoadmapInput {
  return {
    goal: "Become a backend developer",
    level: "BEGINNER",
    durationWeeks: 12,
    hoursPerWeek: 8,
    language: "en",
    ...overrides,
  };
}

class SpyPublisher implements RoadmapJobPublisher {
  initial: string[] = [];
  retries: string[] = [];
  async publishInitial(jobId: string): Promise<string | undefined> {
    this.initial.push(jobId);
    return `msg-${jobId}`;
  }
  async publishRetry(jobId: string): Promise<string | undefined> {
    this.retries.push(jobId);
    return `retry-${jobId}`;
  }
}

class FakeRepo implements RoadmapRepo {
  jobs = new Map<string, RoadmapJob>();
  private nextId = 1;
  candidates: CourseCandidate[];
  progress: Map<string, CourseProgress>;
  lastPersisted?: PersistRoadmap;
  private persistCount = 0;

  constructor(opts: { candidates?: CourseCandidate[]; progress?: Map<string, CourseProgress> } = {}) {
    this.candidates =
      opts.candidates ?? [
        makeCandidate({ id: "c1", title: "Backend with Node.js" }),
        makeCandidate({ id: "c2", title: "Database Design" }),
        makeCandidate({ id: "c3", title: "API Development" }),
      ];
    this.progress = opts.progress ?? makeProgress([{ courseId: "c1", completed: false }, { courseId: "c2", completed: true }]);
  }

  job(id: string): RoadmapJob | undefined {
    return this.jobs.get(id);
  }

  addJob(partial: Partial<RoadmapJob> & { userId: string; fingerprint: string }): RoadmapJob {
    const job: RoadmapJob = {
      id: `job${this.nextId++}`,
      tenantId: "tenant_test",
      goal: "Become a backend developer",
      level: "BEGINNER",
      durationWeeks: 12,
      hoursPerWeek: 8,
      language: "en",
      model: null,
      status: "QUEUED",
      roadmapId: null,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      lastErrorCode: null,
      lastError: null,
      qstashMessageId: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: new Date(),
      progressStage: null,
      ...partial,
      interpretation: partial.interpretation ?? null,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async loadCatalog() {
    return this.candidates;
  }
  async loadProgress() {
    return this.progress;
  }
  async retrieveCandidates(requiredSkills: Parameters<RoadmapRepo["retrieveCandidates"]>[0], opts?: Parameters<RoadmapRepo["retrieveCandidates"]>[1]) {
    const picked = dedupeEquivalentCourses(retrieveCandidatesForRequirements(this.candidates, requiredSkills, opts ?? {}));
    return picked.map((r) => toRetrievalEvidence(r, requiredSkills));
  }

  async persist(roadmap: PersistRoadmap): Promise<RoadmapResult> {
    this.lastPersisted = roadmap;
    return {
      id: "roadmap-1",
      title: roadmap.title,
      goal: roadmap.goal,
      level: roadmap.level as RoadmapResult["level"],
      durationWeeks: roadmap.durationWeeks,
      hoursPerWeek: roadmap.hoursPerWeek,
      language: roadmap.language,
      createdAt: new Date(),
      items: roadmap.stages.map((s, i) => ({
        id: `item-${i}`,
        stageNumber: s.stageNumber,
        title: s.title,
        description: s.description,
        goal: s.goal,
        weekStart: s.weekStart,
        weekEnd: s.weekEnd,
        courseId: s.courseId,
        courseTitle: s.courseTitle,
        courseReason: s.courseReason,
        status: s.isTopic ? "SUGGESTED" : "NOT_STARTED",
        isTopic: s.isTopic,
        skills: s.skills,
        estimatedWeeks: s.estimatedWeeks,
        prerequisites: s.prerequisites,
        milestones: s.milestones,
        matchQuality: s.matchQuality ?? null,
      })),
      isDuplicate: false,
    };
  }

  async setProgressStage(jobId: string, stage: ProgressStage) {
    const j = this.jobs.get(jobId);
    if (j) j.progressStage = stage;
  }

  async completeJobWithRoadmap(jobId: string, roadmap: PersistRoadmap): Promise<RoadmapResult> {
    this.persistCount += 1;
    const result = await this.persist(roadmap);
    const j = this.jobs.get(jobId);
    if (j) {
      j.status = "COMPLETED";
      j.roadmapId = result.id;
      j.progressStage = "completed";
      j.completedAt = new Date();
    }
    return result;
  }

  get persistCalls(): number {
    return this.persistCount;
  }

  async getJobByFingerprint(userId: string, fingerprint: string) {
    for (const j of this.jobs.values()) {
      if (j.userId === userId && j.fingerprint === fingerprint) return j;
    }
    return null;
  }
  async getJobById(jobId: string) {
    return this.jobs.get(jobId) ?? null;
  }
  async createJob(job: RoadmapJobCreate) {
    if (await this.getJobByFingerprint(job.userId, job.fingerprint)) return null;
    const created: RoadmapJob = {
      ...job,
      id: `job${this.nextId++}`,
      status: "QUEUED",
      roadmapId: null,
      attemptCount: 0,
      lastErrorCode: null,
      interpretation: job.interpretation ?? null,
      lastError: null,
      qstashMessageId: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: new Date(),
      progressStage: "interpreting",
    };
    this.jobs.set(created.id, created);
    return created;
  }
  async resetFailedJob(userId: string, fingerprint: string) {
    const j = await this.getJobByFingerprint(userId, fingerprint);
    if (j?.status === "FAILED") {
      j.status = "QUEUED";
      j.attemptCount = 0;
      j.lastErrorCode = null;
      j.lastError = null;
      j.failedAt = null;
    }
  }
  async resetForRefresh(userId: string, fingerprint: string) {
    const j = await this.getJobByFingerprint(userId, fingerprint);
    if (j) {
      j.status = "QUEUED";
      j.attemptCount = 0;
      j.lastErrorCode = null;
      j.lastError = null;
      j.roadmapId = null;
      j.failedAt = null;
      j.completedAt = null;
    }
  }
  async claimJob(jobId: string, expiresAt: Date) {
    const j = this.jobs.get(jobId);
    if (!j || j.status !== "QUEUED") return false;
    j.status = "PROCESSING";
    j.expiresAt = expiresAt;
    j.attemptCount += 1;
    j.startedAt = new Date();
    j.lastErrorCode = null;
    j.lastError = null;
    return true;
  }
  async stealJob(jobId: string, expiresAt: Date) {
    const j = this.jobs.get(jobId);
    if (!j || j.status !== "PROCESSING" || j.expiresAt >= new Date()) return false;
    j.expiresAt = expiresAt;
    j.attemptCount += 1;
    j.startedAt = new Date();
    return true;
  }
  async markJobCompleted(jobId: string, roadmapId: string) {
    const j = this.jobs.get(jobId);
    if (j) {
      j.status = "COMPLETED";
      j.roadmapId = roadmapId;
      j.completedAt = new Date();
    }
  }
  async markJobFailed(jobId: string, code: string, message: string) {
    const j = this.jobs.get(jobId);
    if (j) {
      j.status = "FAILED";
      j.lastErrorCode = code;
      j.lastError = message;
      j.failedAt = new Date();
    }
  }
  async requeueJob(jobId: string, expiresAt: Date, code: string, message: string) {
    const j = this.jobs.get(jobId);
    if (j) {
      j.status = "QUEUED";
      j.expiresAt = expiresAt;
      j.lastErrorCode = code;
      j.lastError = message;
      j.startedAt = null;
    }
  }
  async setJobMessageId(jobId: string, messageId: string | null) {
    const j = this.jobs.get(jobId);
    if (j) j.qstashMessageId = messageId;
  }
}

function countingProvider() {
  const inner = createMockProvider();
  let calls = 0;
  return {
    provider: {
      generateRoadmap: async (ctx: Parameters<typeof inner.generateRoadmap>[0]) => {
        calls += 1;
        return inner.generateRoadmap(ctx);
      },
    },
    calls: () => calls,
  };
}

function makeService(provider: AIProvider = createMockProvider(), publisher = new SpyPublisher(), opts: RoadmapServiceOptions = {}) {
  return {
    service: new RoadmapService(provider, publisher, opts),
    publisher,
  };
}

describe("RoadmapService.createJob", () => {
  test("creates a QUEUED job, publishes, and charges quota once for a new attempt", async () => {
    const repo = new FakeRepo();
    const { service, publisher } = makeService();
    let quota = 0;

    const a = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test",
      publish: true,
      beforeNewAttempt: async () => {
        quota += 1;
      },
    });
    const b = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test",
      publish: true,
      beforeNewAttempt: async () => {
        quota += 1;
      },
    });

    assert.strictEqual(a.isNew, true);
    assert.strictEqual(a.status, "QUEUED");
    assert.strictEqual(b.isNew, false);
    assert.strictEqual(b.jobId, a.jobId, "idempotent retry returns the same job");
    assert.strictEqual(quota, 1, "quota charged exactly once for one accepted attempt");
    assert.deepStrictEqual(publisher.initial, [a.jobId], "published exactly once");
  });

  test("stores the request-time interpretation on the job for the worker to reuse", async () => {
    const repo = new FakeRepo();
    const { service } = makeService();
    const interpretation = {
      role: "backend developer",
      roleId: "backend-developer",
      roleSource: "profile",
      roleConfidence: 0.9,
      domain: "software",
      domainConfidence: 0.7,
      skills: ["database"],
      knownSkills: [],
      level: "BEGINNER",
      confidence: 0.8,
      target: null,
      outcome: null,
      competencies: [],
      ambiguity: { isAmbiguous: false, gaps: [] },
      assumptions: [],
    } as GoalAnalysis;

    const created = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test", interpretation });
    const job = repo.job(created.jobId);
    assert.ok(job, "job exists");
    assert.deepStrictEqual(job.interpretation, interpretation, "interpretation is persisted on the job");

    const result = await service.processJob(created.jobId, repo);
    assert.strictEqual(result.outcome, "completed");
    assert.ok(repo.lastPersisted, "roadmap persists");
    assert.deepStrictEqual(
      repo.lastPersisted?.interpretation.goalAnalysis,
      interpretation,
      "the worker reuses the stored interpretation instead of re-interpreting",
    );
  });

  test("returns the roadmap for an already-COMPLETED job without publishing or quota", async () => {
    const repo = new FakeRepo();
    repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()), status: "COMPLETED", roadmapId: "roadmap-9" });
    const { service, publisher } = makeService();
    let quota = 0;

    const result = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test",
      publish: true,
      beforeNewAttempt: async () => {
        quota += 1;
      },
    });

    assert.deepStrictEqual(result, { jobId: "job1", status: "COMPLETED", roadmapId: "roadmap-9", isNew: false });
    assert.strictEqual(quota, 0);
    assert.deepStrictEqual(publisher.initial, []);
  });

  test("returns a QUEUED / live-PROCESSING job as-is", async () => {
    const repo = new FakeRepo();
    const fp = computeFingerprint("user-1", makeInput());
    repo.addJob({ userId: "user-1", fingerprint: fp, status: "QUEUED" });
    const { service } = makeService();

    const queued = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test", publish: true });
    assert.strictEqual(queued.isNew, false);
    assert.strictEqual(queued.status, "QUEUED");

    const fp2 = computeFingerprint("user-1", makeInput({ goal: "Become a frontend developer" }));
    repo.addJob({ userId: "user-1", fingerprint: fp2, status: "PROCESSING", expiresAt: new Date(Date.now() + 60_000) });
    const processing = await service.createJob("user-1", makeInput({ goal: "Become a frontend developer" }), repo, { publish: true, tenantId: "tenant_test" });
    assert.strictEqual(processing.isNew, false);
    assert.strictEqual(processing.status, "PROCESSING");
  });

  test("re-queues and re-publishes an expired PROCESSING job (crash recovery)", async () => {
    const repo = new FakeRepo();
    const fp = computeFingerprint("user-1", makeInput());
    const job = repo.addJob({ userId: "user-1", fingerprint: fp, status: "PROCESSING", expiresAt: new Date(Date.now() - 1000) });
    const { service, publisher } = makeService();

    const result = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test", publish: true });

    assert.strictEqual(result.status, "QUEUED");
    assert.strictEqual(result.isNew, false);
    assert.strictEqual(repo.job(job.id)?.status, "QUEUED");
    assert.deepStrictEqual(publisher.initial, [job.id]);
  });

  test("resets a FAILED job into a new accepted attempt (quota charged once)", async () => {
    const repo = new FakeRepo();
    const fp = computeFingerprint("user-1", makeInput());
    repo.addJob({ userId: "user-1", fingerprint: fp, status: "FAILED", lastErrorCode: "provider_rejected" });
    const { service, publisher } = makeService();
    let quota = 0;

    const result = await service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test",
      publish: true,
      beforeNewAttempt: async () => {
        quota += 1;
      },
    });

    assert.strictEqual(result.isNew, true);
    assert.strictEqual(result.status, "QUEUED");
    assert.strictEqual(quota, 1);
    assert.strictEqual(publisher.initial.length, 1);
  });

  test("aborts before mutation when the quota check throws", async () => {
    const repo = new FakeRepo();
    const { service } = makeService();

    await assert.rejects(
      service.createJob("user-1", makeInput(), repo, {
      tenantId: "tenant_test",
        beforeNewAttempt: async () => {
          throw new ApiError(429, "limit");
        },
      }),
      (err: unknown) => (err as ApiError).statusCode === 429,
    );
    assert.strictEqual(repo.jobs.size, 0, "no job created when quota is exhausted");
  });
});

describe("RoadmapService.processJob", () => {
  test("claims a QUEUED job, runs the pipeline once, and marks it COMPLETED", async () => {
    const repo = new FakeRepo();
    const fp = computeFingerprint("user-1", makeInput());
    const job = repo.addJob({ userId: "user-1", fingerprint: fp });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    assert.strictEqual(calls(), 1);
    assert.strictEqual(repo.job(job.id)?.status, "COMPLETED");
    assert.strictEqual(repo.job(job.id)?.roadmapId, "roadmap-1");
    assert.strictEqual(repo.job(job.id)?.attemptCount, 1);
  });

  test("duplicate delivery after COMPLETED is a no-op (no second AI call)", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    await service.processJob(job.id, repo);
    const second = await service.processJob(job.id, repo);

    assert.strictEqual(second.outcome, "noop");
    assert.strictEqual(calls(), 1);
  });

  test("a live PROCESSING lease blocks a concurrent delivery", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()), status: "PROCESSING", expiresAt: new Date(Date.now() + 60_000) });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "noop");
    assert.strictEqual(calls(), 0);
  });

  test("an expired PROCESSING job is stolen and completed exactly once", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()), status: "PROCESSING", expiresAt: new Date(Date.now() - 1000), attemptCount: 1 });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    assert.strictEqual(calls(), 1);
    assert.strictEqual(repo.job(job.id)?.attemptCount, 2);
  });

  test("retryable failures re-queue and re-publish, then FAIL after attempts are exhausted", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const publisher = new SpyPublisher();
    // Provider that always throws a 502 (retryable).
    const service = new RoadmapService(
      {
        generateRoadmap: async () => {
          throw new ApiError(502, "boom");
        },
      },
      publisher,
      { maxJobAttempts: 2 },
    );

    const first = await service.processJob(job.id, repo);
    assert.strictEqual(first.outcome, "retryable");
    assert.strictEqual(repo.job(job.id)?.status, "QUEUED");
    assert.strictEqual(repo.job(job.id)?.lastErrorCode, "provider_unavailable");
    assert.deepStrictEqual(publisher.retries, [job.id]);

    const second = await service.processJob(job.id, repo);
    assert.strictEqual(second.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.job(job.id)?.failedAt !== null, true);
  });

  test("non-retryable failures FAIL immediately", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const service = new RoadmapService(
      {
        generateRoadmap: async () => {
          throw new ApiError(400, "rejected");
        },
      },
      new SpyPublisher(),
    );

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(result.code, "provider_rejected");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
  });

  test("a job missing its input snapshot FAILS without calling the provider", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()), goal: null, level: null });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(result.code, "missing_input");
    assert.strictEqual(calls(), 0);
  });

  test("provider failure marks the job FAILED (rollback: nothing persisted)", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const service = new RoadmapService(createFailingMockProvider(), new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.job(job.id)?.roadmapId, null);
  });

  test("resolves candidate keys to real catalog ids and demotes duplicates", async () => {
    const goal = "Become a backend API and database developer";
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput({ goal })), goal });
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const [first, second] = ctx.candidates;
        return {
          title: "Test Plan",
          summary: "Test",
          stages: [
            { stageNumber: 1, title: "S1", description: null, goal: null, weekStart: 1, weekEnd: 4, courseKey: first?.key ?? null, reason: null, isTopic: false },
            { stageNumber: 2, title: "S2", description: null, goal: null, weekStart: 5, weekEnd: 8, courseKey: first?.key ?? null, reason: null, isTopic: false },
            { stageNumber: 3, title: "S3", description: null, goal: null, weekStart: 9, weekEnd: 12, courseKey: second?.key ?? null, reason: null, isTopic: false },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.strictEqual(stages.filter((s) => s.courseId === "c1").length, 1, "c1 resolved once");
    assert.strictEqual(stages.filter((s) => s.courseId === "c2").length, 1, "c2 resolved");
    const demoted = stages.find((s) => s.courseId === null && s.isTopic && s.courseReason === "Appears elsewhere in this roadmap.");
    assert.ok(demoted, "second occurrence of the same course is demoted to a topic");
  });

  test("a hallucinated key (not in the catalog) is demoted to a topic", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return {
          title: "Test Plan",
          summary: "Test",
          stages: [
            { stageNumber: 1, title: "S1", description: null, goal: null, weekStart: 1, weekEnd: 12, courseKey: first?.key ?? null, reason: null, isTopic: false },
            { stageNumber: 2, title: "S2", description: null, goal: null, weekStart: 1, weekEnd: 12, courseKey: "cand-does-not-exist", reason: null, isTopic: false },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.strictEqual(stages.filter((s) => s.courseId === "c1").length, 1);
    const bad = stages[1]!;
    assert.strictEqual(bad.courseId, null);
    assert.strictEqual(bad.isTopic, true);
    assert.strictEqual(bad.courseReason, "No matching EduPro course was found for this stage.");
  });

  test("weeks are recomputed server-side from real course hours, clamped to the duration", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return {
          title: "Test Plan",
          summary: "Test",
          stages: [
            { stageNumber: 1, title: "S1", description: null, goal: null, weekStart: 5, weekEnd: 20, courseKey: first?.key ?? null, reason: null, isTopic: false },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    const stage = stages[0]!;
    assert.strictEqual(stage.weekStart, 1);
    assert.strictEqual(stage.weekEnd, 12);
    assert.strictEqual(stage.estimatedWeeks, 12);
  });

  test("without estimated hours, a single course spans the whole requested duration", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput({ durationWeeks: 6 })), durationWeeks: 6 });
    const service = new RoadmapService(createMockProvider(), new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.ok(stages.length >= 1);
    for (const s of stages) {
      assert.ok(s.weekStart >= 1);
      assert.ok(s.weekEnd <= 6);
      assert.ok(s.weekStart <= s.weekEnd);
    }
  });

  test("prerequisite courses are reordered BEFORE the courses that need them, from real course data", async () => {
    const repo = new FakeRepo({
      candidates: [
        makeCandidate({ id: "js-1", title: "JavaScript Essentials", skills: ["javascript"], category: "Frontend" }),
        makeCandidate({ id: "react-1", title: "React Builds", skills: ["react", "javascript"], prerequisites: ["javascript"], category: "Frontend" }),
      ],
    });
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput({ goal: "become a frontend developer" })), goal: "become a frontend developer" });
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const react = ctx.candidates.find((c) => c.id === "react-1");
        const js = ctx.candidates.find((c) => c.id === "js-1");
        return {
          title: "React Path",
          summary: "Build with React",
          stages: [
            { stageNumber: 1, title: "React", description: null, goal: null, weekStart: 1, weekEnd: 4, courseKey: react?.key ?? null, reason: null, isTopic: false },
            { stageNumber: 2, title: "JavaScript", description: null, goal: null, weekStart: 1, weekEnd: 4, courseKey: js?.key ?? null, reason: null, isTopic: false },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    const jsStage = stages.find((s) => s.courseId === "js-1")!;
    const reactStage = stages.find((s) => s.courseId === "react-1")!;
    assert.ok(jsStage.stageNumber < reactStage.stageNumber, "JavaScript (prerequisite) must precede React");
  });

  test("a plan exceeding 8 stages fails validation and is retried, then FAILS", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return {
          title: "Test Plan",
          summary: "Test",
          stages: Array.from({ length: 10 }, (_, i) => ({
            stageNumber: i + 1,
            title: `S${i + 1}`,
            description: null,
            goal: null,
            weekStart: i + 1,
            weekEnd: i + 1,
            courseKey: first?.key ?? null,
            reason: null,
            isTopic: false,
          })),
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher(), { maxJobAttempts: 1 });

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.job(job.id)?.roadmapId, null);
  });

  test("completed courses from the user's progress are not re-recommended", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const service = new RoadmapService(createMockProvider(), new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.strictEqual(stages.filter((s) => s.courseId === "c2").length, 0);
  });

  test("builds an UNAVAILABLE path when no candidates match and never calls the provider", async () => {
    const repo = new FakeRepo({ candidates: [] });
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    assert.strictEqual(calls(), 0, "no AI call when there is nothing to sequence");
    assert.strictEqual(repo.lastPersisted?.catalogCoverage, "UNAVAILABLE");
    assert.deepStrictEqual(repo.lastPersisted?.stages, [], "no fake generic topic is invented");
    assert.strictEqual(repo.lastPersisted?.title, "Backend Developer Foundations");
  });

  test("the planner receives a bounded candidate budget, not the whole catalog", async () => {
    const goal = "Become a database engineer";
    const candidates = Array.from({ length: 40 }, (_, i) =>
      makeCandidate({ id: `cdb-${i}`, title: `Database Engineering ${i}`, category: "Database" }),
    );
    const repo = new FakeRepo({ candidates });
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput({ goal })), goal });
    let seenCount = 0;
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        seenCount = ctx.candidates.length;
        const last = ctx.candidates[ctx.candidates.length - 1];
        return {
          title: "Test Plan",
          summary: "Test",
          stages: [
            { stageNumber: 1, title: "S1", description: null, goal: null, weekStart: 1, weekEnd: 12, courseKey: last?.key ?? null, reason: null, isTopic: false },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    assert.ok(seenCount > 0 && seenCount <= 24, `AI must see a bounded candidate budget, not the whole catalog (saw ${seenCount})`);
    const stages = repo.lastPersisted?.stages ?? [];
    const stage = stages[0]!;
    assert.ok(stage.courseId, "a budgeted candidate resolves to its real id");
  });

  test("persists durable generation metadata (provider usage, duration, attempt)", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const inner = createMockProvider();
    const provider: AIProvider = {
      async generateRoadmap(ctx: PlannerContext) {
        const plan = await inner.generateRoadmap(ctx);
        return {
          ...plan,
          usage: {
            provider: "nim",
            model: "nim-model",
            inputTokens: 120,
            outputTokens: 80,
            totalTokens: 200,
            usageSource: "provider_reported" as const,
          },
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const meta = repo.lastPersisted?.metadata;
    assert.ok(meta, "metadata must be persisted with the roadmap");
    assert.strictEqual(meta.provider, "nim");
    assert.strictEqual(meta.model, "nim-model");
    assert.strictEqual(meta.inputTokens, 120);
    assert.strictEqual(meta.outputTokens, 80);
    assert.strictEqual(meta.totalTokens, 200);
    assert.strictEqual(meta.usageSource, "provider_reported");
    assert.ok(meta.durationMs !== null && meta.durationMs >= 0);
    assert.ok(meta.generatedAt instanceof Date);
    assert.strictEqual(meta.attemptCount, 1);
    assert.strictEqual(meta.retryCount, 0);
    assert.strictEqual(repo.lastPersisted?.saved, false, "generated roadmaps persist as unsaved drafts");
  });

  test("completing a job atomically marks it COMPLETED with the roadmap id and honest progress stage", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const service = new RoadmapService(createMockProvider(), new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const after = repo.jobs.get(job.id)!;
    assert.strictEqual(after.status, "COMPLETED");
    assert.strictEqual(after.roadmapId, "roadmap-1", "the roadmap must be linked to the completed job");
    assert.strictEqual(after.progressStage, "completed");
    assert.strictEqual(repo.persistCalls, 1, "the roadmap is persisted exactly once (no orphan rows)");
    assert.ok(after.completedAt instanceof Date);
  });

  test("records unavailable usage when the provider reports none", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const service = new RoadmapService(createMockProvider(), new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const meta = repo.lastPersisted?.metadata;
    assert.ok(meta);
    assert.strictEqual(meta.provider, null);
    assert.strictEqual(meta.usageSource, "unavailable");
    assert.strictEqual(meta.inputTokens, null);
  });

  test("persists the deterministic interpretation, coverage breakdown and per-stage match quality", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const service = new RoadmapService(createMockProvider(), new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const persisted = repo.lastPersisted;
    assert.ok(persisted, "roadmap must be persisted");
    // Interpretation
    assert.ok(persisted.interpretation, "interpretation must be persisted");
    assert.strictEqual(persisted.interpretation.goalAnalysis.role, "backend developer");
    assert.ok(persisted.interpretation.requiredSkills.length > 0, "required skills must be computed");
    assert.ok(persisted.confidence >= 0 && persisted.confidence <= 1, "confidence is a 0..1 fraction");
    assert.ok(Array.isArray(persisted.assumptions), "assumptions must be an array");
    // Coverage honesty
    assert.ok(persisted.goalCoverage >= 0 && persisted.goalCoverage <= 100, "goal coverage is a percentage");
    assert.ok(persisted.courseAvailability >= 0 && persisted.courseAvailability <= 100, "course availability is a percentage");
    assert.ok(persisted.coverageBreakdown.skills.length === persisted.interpretation.requiredSkills.length, "one coverage entry per required skill");
    assert.ok(["excellent", "good", "partial", "poor"].includes(persisted.roadmapQuality), "roadmap quality is one of the known tiers");
    // Per-stage match quality is server-computed (never from the AI)
    for (const s of persisted.stages) {
      if (s.courseId) {
        assert.ok(["DIRECT", "STRONG", "RELATED", "WEAK"].includes(s.matchQuality ?? ""), `stage ${s.stageNumber} has a valid match quality`);
      } else {
        assert.strictEqual(s.matchQuality, null, "topic stages have no match quality");
      }
    }
  });

  test("equivalent courses (near-identical skill sets) are deduplicated before the AI", async () => {
    const candidates = [
      makeCandidate({ id: "eq-1", title: "Node Backend A", skills: ["backend", "api", "node"] }),
      makeCandidate({ id: "eq-2", title: "Node Backend B", skills: ["backend", "api", "node"] }),
      makeCandidate({ id: "eq-3", title: "Node Backend C", skills: ["backend", "api", "node"] }),
      makeCandidate({ id: "db-1", title: "SQL Database Design", skills: ["database", "sql"] }),
    ];
    const repo = new FakeRepo({ candidates });
    const goal = "Become a backend developer";
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput({ goal })), goal });
    let seenKeys: string[] = [];
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        seenKeys = ctx.candidates.map((c) => c.id);
        const first = ctx.candidates[0];
        return {
          title: "Test Plan",
          summary: "Test",
          stages: [
            { stageNumber: 1, title: "S1", description: null, goal: null, weekStart: 1, weekEnd: 12, courseKey: first?.key ?? null, reason: null, isTopic: false },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const eqCount = seenKeys.filter((id) => id.startsWith("eq-")).length;
    assert.strictEqual(eqCount, 1, "only one of the three equivalent courses reaches the AI");
    assert.ok(seenKeys.includes("db-1"), "a distinct course must not be dropped");
  });

  test("stage skills are normalized through the real skill vocabulary", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return {
          title: "Test Plan",
          summary: "Test",
          stages: [
            {
              stageNumber: 1,
              title: "S1",
              description: null,
              goal: null,
              weekStart: 1,
              weekEnd: 12,
              courseKey: first?.key ?? null,
              reason: null,
              isTopic: false,
              skills: ["Backend", "quantum alchemy", "Node.js"],
              milestones: ["Build a real app"],
            },
          ],
        };
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);
    assert.strictEqual(result.outcome, "completed");
    const stage = (repo.lastPersisted?.stages ?? [])[0]!;
    assert.deepStrictEqual(stage.skills, ["backend", "node"], "hallucinated skills are dropped, real ones kept");
    assert.deepStrictEqual(stage.milestones, ["Build a real app"], "milestones pass through");
  });
});

describe("interpretGoalWithFallback", () => {
  test("uses the AI interpretation when it is valid", async () => {
    const provider = {
      async generateRoadmap() {
        return { title: "", summary: "", stages: [] };
      },
      async interpretGoal(): Promise<GoalInterpretation> {
        return {
          role: "data engineer",
          roleId: "data-engineer",
          roleSource: "general",
          roleConfidence: 0.7,
          domain: "data",
          domainConfidence: 0.6,
          skills: ["database"],
          knownSkills: [],
          level: "BEGINNER",
          confidence: 0.8,
          target: null,
          outcome: null,
          competencies: [],
          ambiguity: { isAmbiguous: false, gaps: [] },
          assumptions: ["Assumed a data role"],
        };
      },
    } as AIProvider;
    const result = await interpretGoalWithFallback(provider, "Become a data engineer", "en");
    assert.strictEqual(result.role, "data engineer");
    assert.deepStrictEqual(result.skills, ["database"]);
    assert.strictEqual(result.level, "BEGINNER");
  });

  test("falls back to the deterministic analyzer when the AI output is invalid", async () => {
    const provider = {
      async generateRoadmap() {
        return { title: "", summary: "", stages: [] };
      },
      async interpretGoal(): Promise<GoalInterpretation> {
        return { skills: "not-an-array", confidence: 2 } as unknown as GoalInterpretation;
      },
    } as AIProvider;
    const result = await interpretGoalWithFallback(provider, "Become a backend developer and learn PostgreSQL", "en");
    assert.strictEqual(result.role, "backend developer");
    assert.ok(result.skills.includes("database"));
  });

  test("falls back when the provider has no interpretGoal method", async () => {
    const provider = {
      async generateRoadmap() {
        return { title: "", summary: "", stages: [] };
      },
    } as AIProvider;
    const result = await interpretGoalWithFallback(provider, "Become a backend developer", "en");
    assert.strictEqual(result.role, "backend developer");
  });

  test("falls back when the provider throws", async () => {
    const provider = {
      async generateRoadmap() {
        return { title: "", summary: "", stages: [] };
      },
      async interpretGoal(): Promise<GoalInterpretation> {
        throw new Error("provider down");
      },
    } as AIProvider;
    const result = await interpretGoalWithFallback(provider, "Become a backend developer", "en");
    assert.strictEqual(result.role, "backend developer");
  });
});

describe("computeFingerprint", () => {
  test("is stable and includes language", () => {
    const a = computeFingerprint("user-1", makeInput());
    const b = computeFingerprint("user-1", makeInput());
    assert.strictEqual(a, b);
    const th = computeFingerprint("user-1", makeInput({ language: "th" }));
    assert.notStrictEqual(a, th);
  });

  test("differs across users and goals", () => {
    assert.notStrictEqual(
      computeFingerprint("user-1", makeInput()),
      computeFingerprint("user-2", makeInput()),
    );
    assert.notStrictEqual(
      computeFingerprint("user-1", makeInput()),
      computeFingerprint("user-1", makeInput({ goal: "Become a data scientist" })),
    );
  });

  test("an explicit regenerate (refresh=true) gets a fresh fingerprint every time", () => {
    // A completed roadmap must NEVER be returned for an explicit regenerate.
    const base = computeFingerprint("user-1", makeInput());
    const r1 = computeFingerprint("user-1", makeInput({ refresh: true }));
    const r2 = computeFingerprint("user-1", makeInput({ refresh: true }));
    assert.notStrictEqual(r1, base);
    assert.notStrictEqual(r2, base);
    assert.notStrictEqual(r1, r2, "each regenerate is a genuinely new generation");
  });

  test("a different model is a different generation", () => {
    const a = computeFingerprint("user-1", makeInput({ model: "model-a" }));
    const b = computeFingerprint("user-1", makeInput({ model: "model-b" }));
    assert.notStrictEqual(a, b, "switching the model must never return a cached roadmap");
    assert.strictEqual(a, computeFingerprint("user-1", makeInput({ model: "model-a" })), "same model stays stable");
  });
});

describe("plan validation treats AI output as untrusted", () => {
  function basePlan(stages: AIRoadmapPlan["stages"], title = "Valid Plan"): AIRoadmapPlan {
    return { title, summary: "summary", stages };
  }
  function stage(overrides: Partial<AIRoadmapPlan["stages"][number]> = {}): AIRoadmapPlan["stages"][number] {
    return {
      stageNumber: 1,
      title: "S1",
      description: null,
      goal: null,
      weekStart: 1,
      weekEnd: 2,
      courseKey: "cand-0",
      reason: null,
      isTopic: false,
      skills: [],
      ...overrides,
    };
  }

  test("malformed output (a string, not a plan object) fails the schema, is retried, then FAILS", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(_ctx: PlannerContext): Promise<AIRoadmapPlan> {
        void _ctx;
        return "not a plan" as unknown as AIRoadmapPlan;
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher(), { maxJobAttempts: 1 });

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.job(job.id)?.roadmapId, null, "nothing persisted for invalid output");
  });

  test("an oversized title (>120 chars) fails the schema and persists nothing", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(_ctx: PlannerContext): Promise<AIRoadmapPlan> {
        void _ctx;
        return basePlan([stage()], "x".repeat(121));
      },
    };
    const service = new RoadmapService(provider, new SpyPublisher(), { maxJobAttempts: 1 });

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.lastPersisted, undefined, "nothing persisted for an oversized title");
  });
});
