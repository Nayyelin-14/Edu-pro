/**
 * Integration tests for DB-enforced idempotent roadmap generation (async jobs).
 *
 * These run against a dedicated throwaway Neon database (elearning_test) that
 * is dropped + recreated and fully migrated on every invocation.
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createMockProvider } from "@/lib/ai/mock";
import type { PlannerContext } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { NoopRoadmapPublisher } from "@/server/services/roadmap.job-publisher";
import { computeFingerprint, PrismaRoadmapRepo, RoadmapService } from "@/server/services/roadmap.service";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

const execFileP = promisify(execFile);
const input = {
  goal: "Become a backend developer",
  level: "BEGINNER" as const,
  durationWeeks: 12,
  hoursPerWeek: 8,
  language: "en" as const,
};

let seq = 0;

async function seedUser(): Promise<string> {
  seq += 1;
  const id = `it-user-${Date.now()}-${seq}`;
  await prisma.user.create({
    data: { id, email: `${id}@example.com`, username: id, password: "x" },
  });
  // Workers re-verify membership at execution time (Phase H) — grant it.
  const t = await prisma.tenant.findUnique({ where: { slug: "fixture-default" } })
    ?? await prisma.tenant.create({ data: { name: "Fixture Tenant", slug: "fixture-default" } });
  await prisma.tenantMembership.create({
    data: { userId: id, tenantId: t.id, role: "STUDENT" },
  });
  return id;
}

let _tid: string | null = null;
async function getTid(): Promise<string> {
  if (_tid) return _tid;
  const t = await prisma.tenant.findUnique({ where: { slug: "fixture-default" } })
    ?? await prisma.tenant.create({ data: { name: "Fixture Tenant", slug: "fixture-default" } });
  _tid = t.id;
  return _tid;
}

async function seedCourse(): Promise<void> {
  seq += 1;
  const category = await prisma.category.create({
    data: { name: `Cat-${Date.now()}-${seq}`, slug: `cat-${Date.now()}-${seq}` },
  });
  const course = await prisma.course.create({
    data: {
      slug: `course-${Date.now()}-${seq}`,
      title: `Backend with Node.js ${seq}`,
      categoryId: category.id,
      isPublished: true,
      price: 0,
      tenantId: await getTid(),
    },
  });
  const courseModule = await prisma.module.create({ data: { courseId: course.id, title: "M", position: 1, tenantId: await getTid() } });
  await prisma.lesson.create({ data: { moduleId: courseModule.id, title: "L", type: "READING", position: 1, tenantId: await getTid() } });
}

function countingProvider(delayMs = 0) {
  const inner = createMockProvider();
  let calls = 0;
  return {
    provider: {
      async generateRoadmap(ctx: PlannerContext) {
        calls += 1;
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        return inner.generateRoadmap(ctx);
      },
    },
    calls: () => calls,
  };
}

before(async () => {
  await provisionFreshTestDatabase();
});

test("all committed migrations deploy cleanly on a fresh database", async () => {
  const rows = (await prisma.$queryRaw`
    SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at ASC
  `) as Array<{ migration_name: string }>;
  const names = rows.map((r) => r.migration_name);
  assert(names.includes("0_init"), "0_init should be applied");
  assert(names.includes("20260813140000_roadmap_tables"), "roadmap_tables should be applied");
  assert(names.includes("20260813061417_roadmap_generation"), "roadmap_generation should be applied");
  assert(names.includes("20260813150000_roadmap_generation_jobs"), "roadmap_generation_jobs should be applied");
});

test("1,000 identical concurrent deliveries produce exactly one roadmap and one AI call", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { provider, calls } = countingProvider(500);
  const service = new RoadmapService(provider, new NoopRoadmapPublisher());
  const { jobId } = await service.createJob(userId, input, repo, { publish: false, tenantId: await getTid() });

  const settled = await Promise.allSettled(
    Array.from({ length: 1000 }, () => service.processJob(jobId, repo)),
  );

  // Hard idempotency guarantees, regardless of how the load shakes out.
  assert.strictEqual(calls(), 1, "exactly one AI call must be made");
  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 1);
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "PROCESSING" } }),
    0,
    "no claim may remain live after completion",
  );
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "COMPLETED" } }),
    1,
  );
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "FAILED" } }),
    0,
  );

  // Exactly one delivery claims and completes the job; every other concurrent
  // delivery is a no-op (duplicate delivery is safe, never a second AI call).
  const outcomes = settled.map((r) => (r.status === "fulfilled" ? r.value.outcome : `REJECTED`));
  const completed = outcomes.filter((o) => o === "completed").length;
  const noops = outcomes.filter((o) => o === "noop").length;
  assert.strictEqual(completed, 1, "exactly one completed outcome");
  assert.strictEqual(noops, 999, "all other deliveries are idempotent no-ops");
});

test("across multiple application instances only one AI call happens", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const service = new RoadmapService(createMockProvider(), new NoopRoadmapPublisher());
  const { jobId } = await service.createJob(userId, input, repo, { publish: false, tenantId: await getTid() });

  const dir = mkdtempSync(join(tmpdir(), "roadmap-multi-"));
  const counterFile = join(dir, "ai-calls.txt");
  const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
  const worker = join(process.cwd(), "tests", "integration", "worker.ts");

  const run = (count: number, idx: number): Promise<{ uniqueCount: number; allSame: boolean; providerCalls: number; completed: number; noops: number; count: number }> =>
    execFileP(
      tsxBin,
      [worker, userId, jobId, counterFile, String(count), join(dir, `out-${idx}.json`)],
      { env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() } },
    ).then(() => JSON.parse(readFileSync(join(dir, `out-${idx}.json`), "utf8")));

  try {
    const outputs = await Promise.all([run(100, 0), run(100, 1), run(100, 2)]);

    const aiCalls = readFileSync(counterFile, "utf8").split("\n").filter(Boolean).length;
    assert.strictEqual(aiCalls, 1, "exactly one AI call across all instances");
    assert.strictEqual(
      outputs.reduce((acc, o) => acc + o.providerCalls, 0),
      1,
    );
    assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 1);
    assert.strictEqual(
      await prisma.roadmapGeneration.count({ where: { userId, status: "COMPLETED" } }),
      1,
    );
    for (const o of outputs) {
      // Each instance may see 0 or 1 completed roadmap (the loser instances
      // correctly observe only no-ops). No instance may see more than one.
      assert.ok(o.uniqueCount <= 1, "no instance may observe multiple roadmaps");
      assert.strictEqual(o.completed + o.noops, o.count);
    }
    const totalCompleted = outputs.reduce((acc, o) => acc + o.completed, 0);
    const totalNoops = outputs.reduce((acc, o) => acc + o.noops, 0);
    assert.strictEqual(totalCompleted, 1, "exactly one winner across all instances");
    assert.strictEqual(totalNoops, 299, "all other deliveries are no-ops");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a retry after a lost response returns the committed roadmap without another AI call", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { provider, calls } = countingProvider();
  const service = new RoadmapService(provider, new NoopRoadmapPublisher());

  const created = await service.createJob(userId, input, repo, { publish: false, tenantId: await getTid() });
  const first = await service.processJob(created.jobId, repo);
  assert.strictEqual(first.outcome, "completed");

  // Simulate a lost HTTP response: the caller never saw the 202/200 and retries.
  const retry = await service.createJob(userId, input, repo, { publish: false, tenantId: await getTid() });

  assert.strictEqual(retry.status, "COMPLETED");
  assert.strictEqual(retry.isNew, false);
  assert.strictEqual(retry.roadmapId, first.roadmapId);
  assert.strictEqual(calls(), 1, "retry must not call the AI provider again");
  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 1);
});

test("provider failure marks the job FAILED, persists nothing, and a retry succeeds", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { jobId } = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });

  const failing = await new RoadmapService(createMockProvider({ shouldFail: true }), new NoopRoadmapPublisher()).processJob(jobId, repo);
  assert.strictEqual(failing.outcome, "failed");

  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 0, "no partial roadmap");
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "FAILED" } }),
    1,
  );

  // A new attempt resets the FAILED job to QUEUED and runs it fresh.
  const retried = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });
  assert.strictEqual(retried.isNew, true);
  assert.strictEqual(retried.status, "QUEUED");
  const done = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).processJob(retried.jobId, repo);
  assert.strictEqual(done.outcome, "completed");
  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 1);
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "COMPLETED" } }),
    1,
  );
});

test("an expired PROCESSING job (crash) is stolen and the roadmap is still generated once", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { jobId } = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });

  // Simulate a worker that crashed mid-generation: PROCESSING with an expired lease.
  await prisma.roadmapGeneration.update({
    where: { id: jobId },
    data: { status: "PROCESSING", expiresAt: new Date(Date.now() - 60_000), attemptCount: 1 },
  });

  const { provider, calls } = countingProvider();
  const result = await new RoadmapService(provider, new NoopRoadmapPublisher()).processJob(jobId, repo);

  assert.strictEqual(result.outcome, "completed");
  assert.strictEqual(calls(), 1);
  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 1);
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "COMPLETED" } }),
    1,
  );
  const row = await prisma.roadmapGeneration.findUnique({ where: { id: jobId } });
  assert.strictEqual(row?.attemptCount, 2, "the steal increments the attempt count");
});

test("a live (unexpired) PROCESSING lease blocks duplicate delivery as a no-op", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { jobId } = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });

  await prisma.roadmapGeneration.update({
    where: { id: jobId },
    data: { status: "PROCESSING", expiresAt: new Date(Date.now() + 60_000) },
  });

  const { provider, calls } = countingProvider();
  const result = await new RoadmapService(provider, new NoopRoadmapPublisher()).processJob(jobId, repo);

  assert.strictEqual(result.outcome, "noop");
  assert.strictEqual(calls(), 0, "no AI call while a live worker holds the lease");
  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 0);
  assert.strictEqual(
    await prisma.roadmapGeneration.count({ where: { userId, status: "PROCESSING" } }),
    1,
  );
});

test("persists durable generation metadata to the roadmap row", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { jobId } = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });
  const result = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).processJob(jobId, repo);
  assert.strictEqual(result.outcome, "completed");

  const row = await prisma.roadmap.findFirst({ where: { userId } });
  assert.ok(row, "roadmap row must exist");
  assert.strictEqual(row.usageSource, "unavailable", "mock reports no usage");
  assert.strictEqual(row.provider, null);
  assert.strictEqual(row.inputTokens, null);
  assert.strictEqual(row.attemptCount, 1);
  assert.strictEqual(row.retryCount, 0);
  assert.ok(row.durationMs !== null && row.durationMs >= 0, "duration must be recorded");
  assert.ok(row.generatedAt instanceof Date, "generatedAt must be recorded");
});

test("persists the deterministic interpretation and honest coverage columns", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { jobId } = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });
  const result = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).processJob(jobId, repo);
  assert.strictEqual(result.outcome, "completed");

  const row = await prisma.roadmap.findFirst({ where: { userId } });
  assert.ok(row, "roadmap row must exist");
  assert.ok(row.interpretation, "interpretation Json must be persisted");
  assert.ok(Array.isArray((row.interpretation as { requiredSkills?: unknown[] }).requiredSkills), "requiredSkills present");
  assert.ok(row.confidence >= 0 && row.confidence <= 1, "confidence is 0..1");
  assert.ok(Array.isArray(row.assumptions), "assumptions array persisted");
  assert.ok(row.goalCoverage >= 0 && row.goalCoverage <= 100, "goal coverage persisted");
  assert.ok(row.courseAvailability >= 0 && row.courseAvailability <= 100, "course availability persisted");
  assert.ok(["excellent", "good", "partial", "poor"].includes(row.roadmapQuality), "roadmap quality persisted");
  const breakdown = row.coverageBreakdown as { skills?: unknown[]; goalCoverage?: number; courseAvailability?: number };
  assert.ok(Array.isArray(breakdown.skills), "coverage breakdown skills persisted");
  assert.strictEqual(breakdown.goalCoverage, row.goalCoverage, "breakdown matches column");
  assert.strictEqual(breakdown.courseAvailability, row.courseAvailability, "availability matches column");

  const item = await prisma.roadmapItem.findFirst({ where: { roadmapId: row.id, courseId: { not: null } } });
  assert.ok(item, "a matched item exists");
  assert.ok(["DIRECT", "STRONG", "RELATED", "WEAK"].includes(item.matchQuality ?? ""), "per-stage match quality persisted");
  assert.ok(Array.isArray(item.matchedCompetencies), "matchedCompetencies evidence persisted for 'Why this course?'");

  const generation = await prisma.roadmapGeneration.findUnique({ where: { id: jobId } });
  assert.ok(generation, "job row exists");
  assert.strictEqual(generation.progressStage, "completed", "honest final progress stage persisted");
  assert.ok(generation.completedAt instanceof Date, "completion timestamp recorded");
});

test("generation persists as an unsaved draft until saveMyRoadmap confirms it", async () => {
  const userId = await seedUser();
  await seedCourse();

  const repo = new PrismaRoadmapRepo();
  const { jobId } = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).createJob(userId, input, repo, { publish: false, tenantId: await getTid() });
  const result = await new RoadmapService(createMockProvider(), new NoopRoadmapPublisher()).processJob(jobId, repo);
  assert.strictEqual(result.outcome, "completed");

  const row = await prisma.roadmap.findFirst({ where: { userId } });
  assert.ok(row, "roadmap row must exist");
  assert.strictEqual(row.saved, false, "generated roadmaps are drafts, not yet saved");
  assert.strictEqual(row.savedAt, null);

  // Drafts are excluded from the "My roadmaps" list but retrievable by id.
  assert.strictEqual((await roadmapReadRepo.getMyRoadmaps(userId)).length, 0, "drafts must not appear in the list");
  const draft = await roadmapReadRepo.getMyRoadmap(userId, row.id);
  assert.ok(draft, "owner can still open the draft for review");
  assert.strictEqual(draft.saved, false);

  // Saving flips the flag and makes the roadmap listable.
  const saved = await roadmapReadRepo.saveMyRoadmap(userId, row.id);
  assert.ok(saved, "save must return the saved roadmap");
  assert.strictEqual(saved.saved, true);
  const listed = await roadmapReadRepo.getMyRoadmaps(userId);
  assert.strictEqual(listed.length, 1, "saved roadmap must appear in the list");
  assert.strictEqual(listed[0]!.id, row.id);

  // Save is idempotent and never resurrects another user's roadmap.
  const otherUserId = await seedUser();
  assert.strictEqual(await roadmapReadRepo.saveMyRoadmap(otherUserId, row.id), null, "cannot save someone else's roadmap");
  // IDOR/BOLA: another user cannot read or list the roadmap by changing the id.
  assert.strictEqual(await roadmapReadRepo.getMyRoadmap(otherUserId, row.id), null, "cannot read someone else's roadmap");
  assert.strictEqual((await roadmapReadRepo.getMyRoadmaps(otherUserId)).length, 0, "cannot list someone else's roadmaps");
  assert.strictEqual(await roadmapReadRepo.deleteMyRoadmap(otherUserId, row.id), false, "cannot delete someone else's roadmap");
});

test("the job input snapshot is required; a job without it FAILS without calling the AI", async () => {
  const userId = await seedUser();
  await seedCourse();

  const fingerprint = computeFingerprint(userId, input);
  const job = await prisma.roadmapGeneration.create({
    data: {
      userId,
      tenantId: await getTid(),
      fingerprint,
      status: "QUEUED",
      expiresAt: new Date(Date.now() + 60_000),
      goal: null,
      level: null,
    },
  });

  const { provider, calls } = countingProvider();
  const result = await new RoadmapService(provider, new NoopRoadmapPublisher()).processJob(job.id, new PrismaRoadmapRepo());

  assert.strictEqual(result.outcome, "failed");
  assert.strictEqual(result.code, "missing_input");
  assert.strictEqual(calls(), 0);
});

test("refresh=true creates a genuinely new generation, never reusing the completed one", async () => {
  const userId = await seedUser();
  await seedCourse();

  const service = new RoadmapService(createMockProvider(), new NoopRoadmapPublisher());
  const repo = new PrismaRoadmapRepo();

  // Normal (non-refresh) generation completes and becomes the idempotent result.
  const first = await service.createJob(userId, { ...input, refresh: false }, repo, { publish: false, tenantId: await getTid() });
  assert.strictEqual(first.isNew, true);
  const processed = await service.processJob(first.jobId, repo);
  assert.strictEqual(processed.outcome, "completed");
  assert.ok(processed.roadmapId, "completion returns the persisted roadmap id");

  // The same fingerprint idempotently returns the completed roadmap (no new job).
  const replay = await service.createJob(userId, { ...input, refresh: false }, repo, { publish: false, tenantId: await getTid() });
  assert.strictEqual(replay.status, "COMPLETED");
  assert.strictEqual(replay.roadmapId, processed.roadmapId);
  assert.strictEqual(replay.isNew, false);

  // An explicit regenerate (refresh=true) must NEVER reuse it: new job + new fingerprint.
  const second = await service.createJob(userId, { ...input, refresh: true }, repo, { publish: false, tenantId: await getTid() });
  assert.strictEqual(second.isNew, true, "refresh must not return the completed job");
  assert.notStrictEqual(second.jobId, first.jobId, "a new job row is created for a regenerate");

  assert.strictEqual(await prisma.roadmap.count({ where: { userId } }), 1, "the refresh job is processed lazily by the worker, so no extra roadmap yet");
});
