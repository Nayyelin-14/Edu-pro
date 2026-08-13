import { test, describe } from "node:test";
import assert from "node:assert";
import { RoadmapService, computeFingerprint } from "@/server/services/roadmap.service";
import type { RoadmapRepo, RoadmapJob, RoadmapJobCreate, RoadmapResult, RoadmapServiceOptions, PersistRoadmap } from "@/server/services/roadmap.service";
import type { RoadmapJobPublisher } from "@/server/services/roadmap.job-publisher";
import { createMockProvider, createFailingMockProvider } from "@/lib/ai/mock";
import type { GenerateRoadmapInput } from "@/lib/validation/roadmap";
import type { CourseCandidate, CourseProgress, AIProvider, PlannerContext, AIRoadmapPlan } from "@/lib/ai/provider";
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
    lessonCount: 10,
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
      goal: "Become a backend developer",
      level: "BEGINNER",
      durationWeeks: 12,
      hoursPerWeek: 8,
      language: "en",
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
      ...partial,
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
      })),
      isDuplicate: false,
    };
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
      lastError: null,
      qstashMessageId: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: new Date(),
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
      publish: true,
      beforeNewAttempt: async () => {
        quota += 1;
      },
    });
    const b = await service.createJob("user-1", makeInput(), repo, {
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

  test("returns the roadmap for an already-COMPLETED job without publishing or quota", async () => {
    const repo = new FakeRepo();
    repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()), status: "COMPLETED", roadmapId: "roadmap-9" });
    const { service, publisher } = makeService();
    let quota = 0;

    const result = await service.createJob("user-1", makeInput(), repo, {
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

    const queued = await service.createJob("user-1", makeInput(), repo, { publish: true });
    assert.strictEqual(queued.isNew, false);
    assert.strictEqual(queued.status, "QUEUED");

    const fp2 = computeFingerprint("user-1", makeInput({ goal: "Become a frontend developer" }));
    repo.addJob({ userId: "user-1", fingerprint: fp2, status: "PROCESSING", expiresAt: new Date(Date.now() + 60_000) });
    const processing = await service.createJob("user-1", makeInput({ goal: "Become a frontend developer" }), repo, { publish: true });
    assert.strictEqual(processing.isNew, false);
    assert.strictEqual(processing.status, "PROCESSING");
  });

  test("re-queues and re-publishes an expired PROCESSING job (crash recovery)", async () => {
    const repo = new FakeRepo();
    const fp = computeFingerprint("user-1", makeInput());
    const job = repo.addJob({ userId: "user-1", fingerprint: fp, status: "PROCESSING", expiresAt: new Date(Date.now() - 1000) });
    const { service, publisher } = makeService();

    const result = await service.createJob("user-1", makeInput(), repo, { publish: true });

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

  test("week ranges are clamped to the requested duration", async () => {
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
    assert.strictEqual(stage.weekStart, 5);
    assert.strictEqual(stage.weekEnd, 12);
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

  test("uses a fallback plan when no candidates match and never calls the provider", async () => {
    const repo = new FakeRepo({ candidates: [] });
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const { provider, calls } = countingProvider();
    const service = new RoadmapService(provider, new SpyPublisher());

    const result = await service.processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    assert.strictEqual(calls(), 0, "no AI call when there is nothing to sequence");
  });

  test("the full scored catalog is offered to the planner (no top-15 cap)", async () => {
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
    assert.ok(seenCount > 15, `AI must see the full scored catalog, not a top-15 slice (saw ${seenCount})`);
    const stages = repo.lastPersisted?.stages ?? [];
    const stage = stages[0]!;
    assert.strictEqual(stage.courseId, "cdb-39", "a candidate ranked past position 15 resolves to its real id");
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
            provider: "gemini",
            model: "gemini-2.0-flash",
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
    assert.strictEqual(meta.provider, "gemini");
    assert.strictEqual(meta.model, "gemini-2.0-flash");
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
});
