import { test, describe } from "node:test";
import assert from "node:assert";
import { createMockProvider, createFailingMockProvider } from "@/lib/ai/mock";
import type { PlannerContext } from "@/lib/ai/provider";
import type { CourseCandidate } from "@/lib/ai/provider";

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

function makeContext(overrides: Partial<PlannerContext> = {}): PlannerContext {
  const candidates = [
    makeCandidate({ id: "c1", title: "Backend with Node.js" }),
    makeCandidate({ id: "c2", title: "Database Design" }),
    makeCandidate({ id: "c3", title: "API Development" }),
  ];
  const progress = new Map<string, { courseId: string; enrolled: boolean; completedLessons: number; totalLessons: number; percent: number; completed: boolean }>();
  progress.set("c1", { courseId: "c1", enrolled: true, completedLessons: 5, totalLessons: 10, percent: 50, completed: false });
  return {
    goal: "Become a backend developer",
    skills: ["backend", "database", "api"],
    level: "BEGINNER",
    durationWeeks: 12,
    hoursPerWeek: 8,
    language: "en",
    candidates,
    progress,
    ...overrides,
  };
}

describe("createMockProvider", () => {
  test("returns deterministic plan without API call", async () => {
    const provider = createMockProvider();
    const ctx = makeContext();
    const plan = await provider.generateRoadmap(ctx);
    assert(plan.title.includes("Learning Roadmap"));
    assert(plan.stages.length > 0);
    assert(plan.stages.length <= 8);
  });

  test("respects duration weeks in stage ranges", async () => {
    const provider = createMockProvider();
    const ctx = makeContext({ durationWeeks: 4 });
    const plan = await provider.generateRoadmap(ctx);
    for (const stage of plan.stages) {
      assert(stage.weekStart >= 1);
      assert(stage.weekEnd <= 4);
      assert(stage.weekStart <= stage.weekEnd);
    }
  });

  test("does not recommend completed courses", async () => {
    const provider = createMockProvider();
    const progress = new Map<string, { courseId: string; enrolled: boolean; completedLessons: number; totalLessons: number; percent: number; completed: boolean }>();
    progress.set("c1", { courseId: "c1", enrolled: true, completedLessons: 10, totalLessons: 10, percent: 100, completed: true });
    const ctx = makeContext({ progress });
    const plan = await provider.generateRoadmap(ctx);
    const completedKeys = plan.stages.filter((s) => !s.isTopic).map((s) => s.courseKey);
    const c1 = ctx.candidates.find((c) => c.id === "c1");
    assert(!completedKeys.includes(c1?.key ?? "__none__"));
  });

  test("includes isTopic stages when no matching course", async () => {
    const provider = createMockProvider();
    const ctx = makeContext({ candidates: [] });
    const plan = await provider.generateRoadmap(ctx);
    assert(plan.stages.length > 0);
    const stage = plan.stages[0]!;
    assert.strictEqual(stage.isTopic, true);
    assert.strictEqual(stage.courseKey, null);
  });

  test("stage keys match candidate keys exactly", async () => {
    const provider = createMockProvider();
    const ctx = makeContext();
    const plan = await provider.generateRoadmap(ctx);
    const keys = new Set(ctx.candidates.map((c) => c.key));
    for (const stage of plan.stages) {
      if (!stage.isTopic) {
        assert(keys.has(stage.courseKey ?? ""), `Course key "${stage.courseKey}" not found in candidates`);
      }
    }
  });

  test("handles custom plan override", async () => {
    const customPlan = {
      title: "Custom Plan",
      summary: "Custom summary",
      stages: [
        { stageNumber: 1, title: "Custom Stage", description: null, goal: null, weekStart: 1, weekEnd: 4, courseKey: null, reason: null, isTopic: true },
      ],
    };
    const provider = createMockProvider({ customPlan });
    const ctx = makeContext();
    const plan = await provider.generateRoadmap(ctx);
    assert.strictEqual(plan.title, "Custom Plan");
    assert(plan.stages.length > 0);
    const stage = plan.stages[0]!;
    assert.strictEqual(stage.title, "Custom Stage");
  });
});

describe("createFailingMockProvider", () => {
  test("throws configured error", async () => {
    const provider = createFailingMockProvider("Simulated failure");
    const ctx = makeContext();
    await assert.rejects(provider.generateRoadmap(ctx), /Simulated failure/);
  });

  test("uses default error message", async () => {
    const provider = createFailingMockProvider();
    const ctx = makeContext();
    await assert.rejects(provider.generateRoadmap(ctx), /Mock AI provider failed/);
  });
});