import { test, describe, mock } from "node:test";
import assert from "node:assert";
import { RoadmapService, computeFingerprint } from "@/server/services/roadmap.service";
import { createMockProvider, createFailingMockProvider } from "@/lib/ai/mock";
import type { RoadmapRepo, RoadmapResult } from "@/server/services/roadmap.service";
import type { GenerateRoadmapInput } from "@/lib/validation/roadmap";
import type { CourseCandidate, CourseProgress } from "@/lib/ai/provider";

function makeCandidate(overrides: Partial<CourseCandidate> = {}): CourseCandidate {
  return {
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

function makeRepo(overrides: Partial<RoadmapRepo> = {}): RoadmapRepo {
  const candidates = [
    makeCandidate({ id: "c1", title: "Backend with Node.js" }),
    makeCandidate({ id: "c2", title: "Database Design" }),
    makeCandidate({ id: "c3", title: "API Development" }),
  ];
  const progress = makeProgress([
    { courseId: "c1", completed: false },
    { courseId: "c2", completed: true },
  ]);

  return {
    findRecentDuplicate: mock.fn(async () => null),
    loadCatalog: mock.fn(async () => candidates),
    loadProgress: mock.fn(async () => progress),
    claimGeneration: mock.fn(async () => true),
    resolveGeneration: mock.fn(async () => "busy" as const),
    markGeneration: mock.fn(async () => {}),
    persist: mock.fn(async (roadmap) => ({
      id: "new-roadmap-id",
      title: roadmap.title,
      goal: roadmap.goal,
      level: roadmap.level,
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
    } as RoadmapResult)),
    ...overrides,
  };
}

describe("RoadmapService", () => {
  test("generates roadmap with mocked provider and repo", async () => {
    const provider = createMockProvider();
    const repo = makeRepo();
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);

    assert.strictEqual(result.id, "new-roadmap-id");
    assert.strictEqual(result.goal, input.goal);
    assert.strictEqual(result.level, input.level);
    assert.strictEqual(result.durationWeeks, input.durationWeeks);
    assert.strictEqual(result.hoursPerWeek, input.hoursPerWeek);
    assert.strictEqual(result.language, input.language);
    assert.strictEqual(result.isDuplicate, false);
    assert(result.items.length > 0);
  });

  test("returns existing roadmap on duplicate within 24h", async () => {
    const existingRoadmap: RoadmapResult = {
      id: "existing-id",
      title: "Existing Roadmap",
      goal: "Become a backend developer",
      level: "BEGINNER",
      durationWeeks: 12,
      hoursPerWeek: 8,
      language: "en",
      createdAt: new Date(),
      items: [],
      isDuplicate: false,
    };

    const provider = createMockProvider();
    const loadCatalogMock = mock.fn(async () => []);
    const persistMock = mock.fn(async () => existingRoadmap);
    const repo = makeRepo({
      findRecentDuplicate: mock.fn(async () => existingRoadmap),
      loadCatalog: loadCatalogMock,
      persist: persistMock,
    });
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);

    assert.strictEqual(result.id, "existing-id");
    assert.strictEqual(result.isDuplicate, true);
    assert.strictEqual(loadCatalogMock.mock.callCount(), 0);
    assert.strictEqual(persistMock.mock.callCount(), 0);
  });

  test("validates AI output and throws on invalid", async () => {
    const badProvider = createMockProvider({
      customPlan: {
        title: "",
        summary: "",
        stages: [],
      },
    });
    const repo = makeRepo();
    const service = new RoadmapService(badProvider);
    const input = makeInput();

    await assert.rejects(
      service.generate("user-1", input, repo),
      /Unable to generate your roadmap/
    );
  });

  test("respects max 8 stages", async () => {
    const manyCandidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate({ id: `c${i}`, title: `Course ${i}` })
    );
    const provider = createMockProvider();
    const repo = makeRepo({
      loadCatalog: mock.fn(async () => manyCandidates),
    });
    const service = new RoadmapService(provider);
    const input = makeInput({ durationWeeks: 52 });

    const result = await service.generate("user-1", input, repo);
    assert(result.items.length <= 8);
  });

  test("fallback plan when no candidates match", async () => {
    const provider = createMockProvider();
    const repo = makeRepo({
      loadCatalog: mock.fn(async () => []),
    });
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);
    assert(result.items.length > 0);
    const item = result.items[0]!;
    assert.strictEqual(item.isTopic, true);
    assert.strictEqual(item.courseId, null);
  });

  test("resolves course titles to IDs correctly", async () => {
    const provider = createMockProvider();
    const repo = makeRepo();
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);

    for (const item of result.items) {
      if (!item.isTopic) {
        assert(item.courseId !== null);
        assert(item.courseTitle !== null);
        const originalCandidate = ["Backend with Node.js", "Database Design", "API Development"].includes(item.courseTitle);
        assert(originalCandidate, `Course ${item.courseTitle} should be from catalog`);
      }
    }
  });

  test("demotes duplicate course references to topics", async () => {
    // Custom provider that returns same course twice
    const customPlan = {
      title: "Test Plan",
      summary: "Test",
      stages: [
        { stageNumber: 1, title: "Stage 1", description: null, goal: null, weekStart: 1, weekEnd: 4, courseTitle: "Backend with Node.js", reason: null, isTopic: false },
        { stageNumber: 2, title: "Stage 2", description: null, goal: null, weekStart: 5, weekEnd: 8, courseTitle: "Backend with Node.js", reason: null, isTopic: false },
        { stageNumber: 3, title: "Stage 3", description: null, goal: null, weekStart: 9, weekEnd: 12, courseTitle: "Database Design", reason: null, isTopic: false },
      ],
    };
    const provider = createMockProvider({ customPlan });
    const repo = makeRepo();
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);

    const backendItems = result.items.filter((i) => i.courseTitle === "Backend with Node.js");
    assert.strictEqual(backendItems.length, 1);
    const dupeItem = result.items.find((i) => i.courseTitle === null && i.isTopic && i.courseReason?.includes("Appears elsewhere"));
    assert(dupeItem, "Second occurrence should be demoted to topic");
  });

  test("week ranges are clamped to duration", async () => {
    const customPlan = {
      title: "Test Plan",
      summary: "Test",
      stages: [
        { stageNumber: 1, title: "Stage 1", description: "Test stage", goal: "Test goal", weekStart: 5, weekEnd: 20, courseTitle: "Backend with Node.js", reason: "Test reason", isTopic: false },
      ],
    };
    const provider = createMockProvider({ customPlan });
    const repo = makeRepo();
    const service = new RoadmapService(provider);
    const input = makeInput({ durationWeeks: 12 });

    const result = await service.generate("user-1", input, repo);
    assert(result.items.length > 0);
    const stage = result.items[0]!;
    assert.strictEqual(stage.weekStart, 5);
    assert.strictEqual(stage.weekEnd, 12);
  });

  test("uses user progress to mark completed courses", async () => {
    const provider = createMockProvider();
    const repo = makeRepo();
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);

    // c2 is completed in the mock progress, should not appear as a new stage
    const c2Items = result.items.filter((i) => i.courseId === "c2" && !i.isTopic);
    assert.strictEqual(c2Items.length, 0);
  });

  test("claims the generation slot before calling the provider and marks COMPLETED", async () => {
    const inner = createMockProvider();
    let providerCalls = 0;
    const provider = {
      generateRoadmap: async (ctx: Parameters<typeof inner.generateRoadmap>[0]) => {
        providerCalls += 1;
        return inner.generateRoadmap(ctx);
      },
    };
    const repo = makeRepo();
    const claimGeneration = mock.fn(async () => true);
    repo.claimGeneration = claimGeneration;
    const markGeneration = mock.fn<RoadmapRepo["markGeneration"]>(async () => {});
    repo.markGeneration = markGeneration;
    const service = new RoadmapService(provider);
    const input = makeInput();

    const result = await service.generate("user-1", input, repo);

    assert.strictEqual(providerCalls, 1);
    assert.strictEqual(claimGeneration.mock.callCount(), 1);
    assert.strictEqual(result.isDuplicate, false);
    const markCall = markGeneration.mock.calls[0]!;
    assert.strictEqual(markCall.arguments[1], "COMPLETED");
    assert.strictEqual(markCall.arguments[2], result.id);
  });

  test("returns the winner roadmap when the claim slot is busy (no extra AI call)", async () => {
    const inner = createMockProvider();
    let providerCalls = 0;
    const provider = {
      generateRoadmap: async (ctx: Parameters<typeof inner.generateRoadmap>[0]) => {
        providerCalls += 1;
        return inner.generateRoadmap(ctx);
      },
    };
    const existing: RoadmapResult = {
      id: "winner-roadmap",
      title: "Existing Roadmap",
      goal: "Become a backend developer",
      level: "BEGINNER",
      durationWeeks: 12,
      hoursPerWeek: 8,
      language: "en",
      createdAt: new Date(),
      items: [],
      isDuplicate: false,
    };
    const repo = makeRepo({
      claimGeneration: mock.fn(async () => false),
      resolveGeneration: mock.fn(async () => "busy" as const),
      // Winner's roadmap appears after the first poll.
      findRecentDuplicate: mock.fn(async () => existing),
    });
    const service = new RoadmapService(provider, { claimWaitMs: 500, claimPollMs: 5 });

    const result = await service.generate("user-1", makeInput(), repo);

    assert.strictEqual(providerCalls, 0);
    assert.strictEqual(result.id, "winner-roadmap");
    assert.strictEqual(result.isDuplicate, true);
  });

  test("throws 503 when the claim slot stays busy past the wait window", async () => {
    const provider = createMockProvider();
    const loadCatalog = mock.fn(async () => [] as CourseCandidate[]);
    const repo = makeRepo({
      claimGeneration: mock.fn(async () => false),
      resolveGeneration: mock.fn(async () => "busy" as const),
      findRecentDuplicate: mock.fn(async () => null),
      loadCatalog,
    });
    const service = new RoadmapService(provider, { claimWaitMs: 60, claimPollMs: 5 });

    await assert.rejects(
      service.generate("user-1", makeInput(), repo),
      /already being generated/,
    );
    assert.strictEqual(loadCatalog.mock.callCount(), 0);
  });

  test("marks the claim FAILED and rethrows when generation errors", async () => {
    const provider = createFailingMockProvider();
    const repo = makeRepo();
    const markGeneration = mock.fn<RoadmapRepo["markGeneration"]>(async () => {});
    repo.markGeneration = markGeneration;
    const service = new RoadmapService(provider);

    await assert.rejects(service.generate("user-1", makeInput(), repo));
    const markCall = markGeneration.mock.calls[0]!;
    assert.strictEqual(markCall.arguments[1], "FAILED");
  });

  test("computeFingerprint is stable and includes language", () => {
    const a = computeFingerprint("user-1", makeInput());
    const b = computeFingerprint("user-1", makeInput());
    assert.strictEqual(a, b);
    const th = computeFingerprint("user-1", makeInput({ language: "th" }));
    assert.notStrictEqual(a, th);
  });
});