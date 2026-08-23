/**
 * Phase G — Roadmap/AI catalog tenant isolation tests.
 *
 * The AI planner must never see courses, candidates, or progress data from
 * another tenant. Category data remains globally shared by design.
 *
 * Run with: npx tsx --test tests/integration/roadmap-tenant.test.ts
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import { PrismaRoadmapRepo } from "@/server/services/roadmap.service";
import { fixtureTenantId, grantMembership } from "../helpers/tenant";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

let tenantAId = "";
let tenantBId = "";
let userAId = "";

before(async () => {
  await provisionFreshTestDatabase();
  tenantAId = await fixtureTenantId();
  tenantBId = (
    await prisma.tenant.create({ data: { name: "B", slug: uniq("tb") } })
  ).id;

  const userA = await prisma.user.create({
    data: { id: uniq("ua"), username: uniq("ua"), email: `${uniq("ua")}@x.c`, password: "x" },
  });
  userAId = userA.id;
  await grantMembership(userAId);

  // Course in A (matches "database" skill) and one in B (same skill).
  for (const [tid, slug] of [[tenantAId, "a"], [tenantBId, "b"]] as const) {
    await prisma.course.create({
      data: {
        slug: uniq(`course-${slug}`),
        title: `Database Design ${slug}`,
        isPublished: true,
        tenantId: tid,
        skills: ["database"],
      },
    });
  }
  // Cross-tenant enrollment for progress isolation.
  const courseB = await prisma.course.findFirstOrThrow({ where: { tenantId: tenantBId } });
  await prisma.enrollment.create({
    data: { userId: userAId, courseId: courseB.id, tenantId: tenantBId },
  });
});

test("loadCatalog is tenant-scoped", async () => {
  const repo = new PrismaRoadmapRepo();
  const catA = await repo.loadCatalog(tenantAId);
  const catB = await repo.loadCatalog(tenantBId);
  assert.equal(catA.length, 1);
  assert.equal(catB.length, 1);
  assert.ok(catA[0]!.title.endsWith(" a"));
  assert.ok(catB[0]!.title.endsWith(" b"));
});

test("retrieveCandidates never returns cross-tenant courses", async () => {
  const repo = new PrismaRoadmapRepo();
  const evA = await repo.retrieveCandidates(
    [{ skill: "database", level: "BEGINNER" }] as never,
    { tenantId: tenantAId },
  );
  assert.ok(evA.length >= 1);
  assert.ok(evA.every((e) => e.candidate.title.endsWith(" a")));
  const evB = await repo.retrieveCandidates(
    [{ skill: "database", level: "BEGINNER" }] as never,
    { tenantId: tenantBId },
  );
  assert.ok(evB.every((e) => e.candidate.title.endsWith(" b")));
});

test("loadProgress ignores enrollments from other tenants", async () => {
  const repo = new PrismaRoadmapRepo();
  const progress = await repo.loadProgress(userAId, tenantAId);
  assert.equal(progress.size, 0); // userA only enrolled in a B-tenant course
});

test("Phase H: worker fails closed when membership is revoked mid-queue", async () => {
  const { GenerationStatus } = await import("@/generated/prisma/enums");
  const user = await prisma.user.create({
    data: { id: uniq("uw"), username: uniq("uw"), email: `${uniq("uw")}@x.c`, password: "x" },
  });
  await grantMembership(user.id);
  const job = await prisma.roadmapGeneration.create({
    data: {
      userId: user.id,
      tenantId: tenantAId,
      fingerprint: uniq("fp"),
      status: GenerationStatus.QUEUED,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  // Revoke membership, then attempt execution.
  await prisma.tenantMembership.deleteMany({ where: { userId: user.id } });
  const { RoadmapService } = await import("@/server/services/roadmap.service");
  const { createMockProvider } = await import("@/lib/ai/mock");
  const service = new RoadmapService(createMockProvider(), { publishInitial: async () => null } as never);
  const outcome = await service.processJob(job.id, new PrismaRoadmapRepo());
  assert.equal(outcome.outcome, "noop");
  const failed = await prisma.roadmapGeneration.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.lastErrorCode, "tenant_access_revoked");
});

test("Phase G: roadmap reads, saves, and deletes are tenant-scoped", async () => {
  const { roadmapReadRepo } = await import("@/server/services/roadmap.read.service");
  // Dual-tenant user: INSTRUCTOR in A, STUDENT in B.
  const dual = await prisma.user.create({
    data: { id: uniq("ud"), username: uniq("ud"), email: `${uniq("ud")}@x.c`, password: "x" },
  });
  await prisma.tenantMembership.create({ data: { userId: dual.id, tenantId: tenantAId, role: "INSTRUCTOR" } });
  await prisma.tenantMembership.create({ data: { userId: dual.id, tenantId: tenantBId, role: "STUDENT" } });

  const mk = async (tid: string) =>
    prisma.roadmap.create({
      data: {
        userId: dual.id,
        tenantId: tid,
        goal: uniq("goal"),
        level: "BEGINNER",
        durationWeeks: 4,
        hoursPerWeek: 5,
        language: "en",
        status: "ACTIVE",
        saved: true,
        title: `Roadmap ${tid === tenantAId ? "A" : "B"}`,
      },
    });
  const roadmapA = await mk(tenantAId);
  const roadmapB = await mk(tenantBId);

  // From context A, roadmap B is invisible; from B, roadmap A is invisible.
  const seenFromA = await roadmapReadRepo.getMyRoadmap(dual.id, roadmapB.id, tenantAId);
  assert.equal(seenFromA, null);
  const seenFromB = await roadmapReadRepo.getMyRoadmap(dual.id, roadmapA.id, tenantBId);
  assert.equal(seenFromB, null);

  // Listings never mix tenants.
  const listA = await roadmapReadRepo.getMyRoadmaps(dual.id, tenantAId);
  assert.ok(listA.some((r) => r.id === roadmapA.id));
  assert.ok(!listA.some((r) => r.id === roadmapB.id));

  // Save is scoped: saving B's roadmap "from A" resolves as not found.
  const badSave = await roadmapReadRepo.saveMyRoadmap(dual.id, roadmapB.id, tenantAId);
  assert.equal(badSave, null);

  // Delete is scoped: deleting B's roadmap "from A" reports nothing deleted
  // and the row survives.
  const deletedWrongly = await roadmapReadRepo.deleteMyRoadmap(dual.id, roadmapB.id, tenantAId);
  assert.equal(deletedWrongly, false);
  assert.ok(await prisma.roadmap.findUnique({ where: { id: roadmapB.id } }));

  // The owning tenant context deletes it for real.
  const deletedRightly = await roadmapReadRepo.deleteMyRoadmap(dual.id, roadmapB.id, tenantBId);
  assert.equal(deletedRightly, true);
});

test("Phase G: per-course progress ignores other tenants' enrollments", async () => {
  const { roadmapReadRepo } = await import("@/server/services/roadmap.read.service");
  const courseB = await prisma.course.findFirstOrThrow({ where: { tenantId: tenantBId } });
  // Roadmap in A that references the B-tenant course id as an item target.
  const roadmap = await prisma.roadmap.create({
    data: {
      userId: userAId,
      tenantId: tenantAId,
      goal: uniq("goal"),
      level: "BEGINNER",
      durationWeeks: 4,
      hoursPerWeek: 5,
      language: "en",
      status: "ACTIVE",
      saved: true,
      title: "Progress isolation",
      items: {
        create: {
          stageNumber: 1,
          weekStart: 1,
          weekEnd: 2,
          title: "B course stage",
          courseId: courseB.id,
          isTopic: false,
          tenantId: tenantAId,
        },
      },
    },
  });
  const detail = await roadmapReadRepo.getMyRoadmap(userAId, roadmap.id, tenantAId);
  assert.ok(detail);
  const item = detail!.items.find((i) => i.courseId === courseB.id);
  assert.ok(item);
  // The B-tenant enrollment must NOT surface as progress inside tenant A:
  // no courseProgress is attached and the item is not in-progress/done.
  assert.equal(item!.courseProgress, null);
  assert.notEqual(item!.status, "COMPLETED");
  assert.notEqual(item!.status, "IN_PROGRESS");
});
