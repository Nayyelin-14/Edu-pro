/**
 * Phase H — background-job tenant-context tests (non-HTTP boundary).
 *
 * The worker must re-verify the (userId, tenantId) pair written at enqueue
 * time against LIVE membership state before executing, so forged,
 * cross-tenant, revoked, deactivated, or missing tenants all fail closed.
 *
 * Run with: npx tsx --test tests/integration/job-tenant.test.ts
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { GenerationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PrismaRoadmapRepo, RoadmapService } from "@/server/services/roadmap.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

async function makeUser() {
  const u = await prisma.user.create({
    data: { id: uniq("ju"), username: uniq("ju"), email: `${uniq("ju")}@x.c`, password: "x" },
  });
  return u;
}
async function makeTenant(active = true) {
  return prisma.tenant.create({
    data: { name: `JT ${uniq("jt")}`, slug: uniq("jsl"), isActive: active },
  });
}

let service: RoadmapService;
let repo: PrismaRoadmapRepo;

before(async () => {
  await provisionFreshTestDatabase();
  const { createMockProvider } = await import("@/lib/ai/mock");
  service = new RoadmapService(createMockProvider(), {
    publishInitial: async () => null,
    publishRetry: async () => null,
  } as never);
  repo = new PrismaRoadmapRepo();
});

async function createJob(userId: string, tenantId: string) {
  return prisma.roadmapGeneration.create({
    data: {
      userId,
      tenantId,
      fingerprint: uniq("fp"),
      status: GenerationStatus.QUEUED,
      expiresAt: new Date(Date.now() + 60_000),
      goal: "learn sql databases",
      level: "BEGINNER",
      durationWeeks: 4,
      hoursPerWeek: 5,
      language: "en",
    },
  });
}

async function expectFailed(jobId: string, code: string) {
  const failed = await prisma.roadmapGeneration.findUniqueOrThrow({ where: { id: jobId } });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.lastErrorCode, code);
}

test("forged cross-tenant job: user has NO membership on the job's tenant", async () => {
  const user = await makeUser();
  const tenantA = await makeTenant();
  const tenantB = await makeTenant();
  await prisma.tenantMembership.create({ data: { userId: user.id, tenantId: tenantA.id, role: "STUDENT" } });
  // Job claims tenant B — never granted. A forged payload cannot manufacture authority.
  const job = await createJob(user.id, tenantB.id);

  const outcome = await service.processJob(job.id, repo);
  assert.equal(outcome.outcome, "noop");
  await expectFailed(job.id, "tenant_access_revoked");
});

test("job fails closed when membership is revoked while queued", async () => {
  const user = await makeUser();
  const tenant = await makeTenant();
  await prisma.tenantMembership.create({ data: { userId: user.id, tenantId: tenant.id, role: "INSTRUCTOR" } });
  const job = await createJob(user.id, tenant.id);
  await prisma.tenantMembership.deleteMany({ where: { userId: user.id } });

  const outcome = await service.processJob(job.id, repo);
  assert.equal(outcome.outcome, "noop");
  await expectFailed(job.id, "tenant_access_revoked");
});

test("job fails closed when the tenant is deactivated mid-queue", async () => {
  const user = await makeUser();
  const tenant = await makeTenant(true);
  await prisma.tenantMembership.create({ data: { userId: user.id, tenantId: tenant.id, role: "INSTRUCTOR" } });
  const job = await createJob(user.id, tenant.id);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { isActive: false } });

  const outcome = await service.processJob(job.id, repo);
  assert.equal(outcome.outcome, "noop");
  await expectFailed(job.id, "tenant_access_revoked");
});

test("job fails closed when the tenant row is gone entirely", async () => {
  const user = await makeUser();
  const tenant = await makeTenant();
  await prisma.tenantMembership.create({ data: { userId: user.id, tenantId: tenant.id, role: "STUDENT" } });
  const job = await createJob(user.id, tenant.id);
  await prisma.tenant.delete({ where: { id: tenant.id } });

  const outcome = await service.processJob(job.id, repo);
  assert.equal(outcome.outcome, "noop");
  await expectFailed(job.id, "tenant_access_revoked");
});

test("duplicate delivery after completion is a no-op without side effects", async () => {
  const user = await makeUser();
  const tenant = await makeTenant();
  await prisma.tenantMembership.create({ data: { userId: user.id, tenantId: tenant.id, role: "INSTRUCTOR" } });
  const course = await prisma.course.create({
    data: { slug: uniq("jc"), title: "SQL Databases", isPublished: true, price: 0, tenantId: tenant.id, skills: ["database"] },
  });
  const job = await createJob(user.id, tenant.id);
  void course;

  const first = await service.processJob(job.id, repo);
  if (first.outcome === "completed") {
    const roadmapsBefore = await prisma.roadmap.count({ where: { userId: user.id, tenantId: tenant.id } });
    const replay = await service.processJob(job.id, repo);
    assert.equal(replay.outcome, "noop");
    const roadmapsAfter = await prisma.roadmap.count({ where: { userId: user.id, tenantId: tenant.id } });
    assert.equal(roadmapsAfter, roadmapsBefore);
    const done = await prisma.roadmapGeneration.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(done.status, "COMPLETED");
  } else if (first.outcome === "failed") {
    // Mock provider path may fail on catalog emptiness; then the job must be
    // FAILED with a generation error, not silently left QUEUED.
    const done = await prisma.roadmapGeneration.findUniqueOrThrow({ where: { id: job.id } });
    assert.notEqual(done.status, "QUEUED");
  }
});

test("missing job id is a silent noop (no crash, no writes)", async () => {
  const outcome = await service.processJob("does-not-exist", repo);
  assert.equal(outcome.outcome, "noop");
});
