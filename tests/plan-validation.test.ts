import { test, describe } from "node:test";
import assert from "node:assert";
import { RoadmapService, computeFingerprint } from "@/server/services/roadmap.service";
import type { RoadmapRepo, RoadmapJob, RoadmapJobCreate, RoadmapResult, RoadmapServiceOptions, PersistRoadmap, ProgressStage } from "@/server/services/roadmap.service";
import type { RoadmapJobPublisher } from "@/server/services/roadmap.job-publisher";
import type { GenerateRoadmapInput } from "@/lib/validation/roadmap";
import type { CourseCandidate, CourseProgress, AIProvider, PlannerContext, AIRoadmapPlan } from "@/lib/ai/provider";
import { retrieveCandidatesForRequirements, dedupeEquivalentCourses, toRetrievalEvidence } from "@/lib/ai/retrieval";

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

  constructor(opts: { candidates?: CourseCandidate[]; progress?: Map<string, CourseProgress> } = {}) {
    this.candidates =
      opts.candidates ??
      [
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
    weekEnd: 12,
    courseKey: null,
    reason: null,
    isTopic: false,
    ...overrides,
  };
}

function makeService(provider: AIProvider, opts: RoadmapServiceOptions = {}) {
  return new RoadmapService(provider, new SpyPublisher(), opts);
}

describe("plan validation treats AI output as untrusted (Phase 16 matrix)", () => {
  test("malformed output (a string, not a plan object) fails the schema and persists nothing", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(_ctx: PlannerContext): Promise<AIRoadmapPlan> {
        void _ctx;
        return "not a plan" as unknown as AIRoadmapPlan;
      },
    };

    const result = await makeService(provider, { maxJobAttempts: 1 }).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.lastPersisted, undefined, "nothing persisted for invalid output");
  });

  test("an oversized title (>120 chars) is rejected and nothing persists", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(_ctx: PlannerContext): Promise<AIRoadmapPlan> {
        void _ctx;
        return basePlan([stage()], "x".repeat(121));
      },
    };

    const result = await makeService(provider, { maxJobAttempts: 1 }).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.lastPersisted, undefined, "nothing persisted for an oversized title");
  });

  test("a plan with more than 8 stages fails the schema, is retried, then FAILS", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(_ctx: PlannerContext): Promise<AIRoadmapPlan> {
        void _ctx;
        return basePlan(Array.from({ length: 9 }, () => stage()));
      },
    };

    const result = await makeService(provider, { maxJobAttempts: 1 }).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.lastPersisted, undefined, "nothing persisted for an over-long plan");
  });

  test("a hallucinated course key (not in the catalog) is demoted to a topic, not executed", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return basePlan([
          stage({ courseKey: first?.key ?? null }),
          stage({ courseKey: "cand-this-course-does-not-exist", title: "Fake Course" }),
        ]);
      },
    };

    const result = await makeService(provider).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.strictEqual(stages.length, 2);
    const fake = stages[1]!;
    assert.strictEqual(fake.courseId, null, "hallucinated course never resolves to a real id");
    assert.strictEqual(fake.isTopic, true, "hallucinated course is demoted to a suggested topic");
    assert.ok(fake.courseReason, "an honest reason is persisted");
  });

  test("a course referenced twice is demoted on its second occurrence", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return basePlan([
          stage({ courseKey: first?.key ?? null }),
          stage({ courseKey: first?.key ?? null, title: "Duplicate reference" }),
        ]);
      },
    };

    const result = await makeService(provider).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.strictEqual(stages.filter((s) => s.courseId !== null).length, 1, "course referenced exactly once");
    const dup = stages[1]!;
    assert.strictEqual(dup.courseId, null);
    assert.strictEqual(dup.isTopic, true);
    assert.strictEqual(dup.courseReason, "Appears elsewhere in this roadmap.");
  });

  test("AI week claims that violate the schema (negative / fractional) are rejected, never persisted", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(_ctx: PlannerContext): Promise<AIRoadmapPlan> {
        void _ctx;
        return basePlan([stage({ weekStart: -5, weekEnd: 3.5 })]);
      },
    };

    const result = await makeService(provider, { maxJobAttempts: 1 }).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "failed");
    assert.strictEqual(repo.job(job.id)?.status, "FAILED");
    assert.strictEqual(repo.lastPersisted, undefined, "nothing persisted for schema-invalid weeks");
  });

  test("hallucinated stage skills are normalized through the real vocabulary", async () => {
    const repo = new FakeRepo();
    const job = repo.addJob({ userId: "user-1", fingerprint: computeFingerprint("user-1", makeInput()) });
    const provider: AIProvider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const first = ctx.candidates[0];
        return basePlan([
          stage({ courseKey: first?.key ?? null, skills: ["database", "zerblat", "quantum-leaping", "DATABASE"] }),
        ]);
      },
    };

    const result = await makeService(provider).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const skills = repo.lastPersisted?.stages[0]!.skills ?? [];
    assert.ok(skills.includes("database"), "real skill survives normalization");
    assert.strictEqual(new Set(skills).size, skills.length, "no duplicates after normalization");
    assert.ok(!skills.some((s) => s.includes("zerblat")), "hallucinated skills never persist");
  });

  test("prerequisites are reordered from real course data, even when the AI returns them reversed", async () => {
    const repo = new FakeRepo({
      candidates: [
        makeCandidate({ id: "js-1", title: "JavaScript Essentials", skills: ["javascript"], category: "Frontend" }),
        makeCandidate({ id: "react-1", title: "React Builds", skills: ["react", "javascript"], prerequisites: ["javascript"], category: "Frontend" }),
      ],
    });
    const job = repo.addJob({
      userId: "user-1",
      fingerprint: computeFingerprint("user-1", makeInput({ goal: "become a frontend developer" })),
      goal: "become a frontend developer",
    });
    const provider: AIProvider = {
      async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
        const react = ctx.candidates.find((c) => c.id === "react-1");
        const js = ctx.candidates.find((c) => c.id === "js-1");
        return basePlan(
          [
            stage({ courseKey: react?.key ?? null, title: "React" }),
            stage({ courseKey: js?.key ?? null, title: "JavaScript" }),
          ],
          "React Path",
        );
      },
    };

    const result = await makeService(provider).processJob(job.id, repo);

    assert.strictEqual(result.outcome, "completed");
    const stages = repo.lastPersisted?.stages ?? [];
    assert.strictEqual(stages[0]!.courseId, "js-1", "prerequisite course comes first");
    assert.strictEqual(stages[1]!.courseId, "react-1", "dependent course comes second");
  });
});