/**
 * Mock AI provider for testing.
 *
 * Returns a deterministic plan without calling any external API.
 * Useful for unit tests and CI where no AI API key is available.
 */
import type { AIProvider, PlannerContext, AIRoadmapPlan, AIRoadmapStageInput, GoalInterpretation } from "./provider";
import { analyzeGoal } from "./retrieval";

export interface MockProviderOptions {
  /** Override the default deterministic plan. */
  customPlan?: AIRoadmapPlan;
  /** If true, throws an error instead of returning a plan. */
  shouldFail?: boolean;
  /** Error message to throw when shouldFail is true. */
  errorMessage?: string;
}

/**
 * Creates a mock AI provider that returns a predictable roadmap plan.
 *
 * The mock generates stages that:
 * - Use real course titles from the provided candidates
 * - Respect the duration weeks
 * - Don't reference completed courses
 * - Include both course-matched and suggested-topic stages
 */
export function createMockProvider(options: MockProviderOptions = {}): AIProvider {
  const { customPlan, shouldFail = false, errorMessage = "Mock provider error" } = options;

  return {
    async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan> {
      if (shouldFail) {
        throw new Error(errorMessage);
      }

      if (customPlan) {
        return customPlan;
      }

      return buildDeterministicPlan(ctx);
    },

    // Deterministic mirror of the real NIM interpretation: zero network, so
    // unit tests and CI exercise the same interpretation pipeline shape.
    async interpretGoal(input: { goal: string; language: "en" | "th" }): Promise<GoalInterpretation> {
      return analyzeGoal(input.goal);
    },
  };
}

/**
 * Builds a deterministic plan based on the context.
 * This mimics what the real LLM would produce but is fully predictable.
 */
function buildDeterministicPlan(ctx: PlannerContext): AIRoadmapPlan {
  const { candidates, progress, durationWeeks, goal, skills, normalizedGoal } = ctx;

  // Filter out completed courses from candidates
  const availableCandidates = candidates.filter((c) => {
    const p = progress.get(c.id);
    return !p?.completed;
  });

  // Calculate weeks per stage
  const maxStages = Math.min(8, availableCandidates.length + 1);
  const weeksPerStage = Math.max(1, Math.floor(durationWeeks / Math.max(1, maxStages)));

  const stages: AIRoadmapStageInput[] = [];

  // Add stages for each available course (up to maxStages-1 to leave room for a topic)
  const courseStages = Math.min(maxStages - 1, availableCandidates.length);

  for (let i = 0; i < courseStages; i++) {
    const course = availableCandidates[i];
    if (!course) continue;
    const weekStart = i * weeksPerStage + 1;
    const weekEnd = Math.min((i + 1) * weeksPerStage, durationWeeks);
    const courseSkills = course.skills?.length ? course.skills : skills;

    stages.push({
      stageNumber: i + 1,
      title: course.title,
      description: `Learn ${course.title.toLowerCase()} through structured lessons and hands-on exercises.`,
      goal: `Master the fundamentals of ${course.title.toLowerCase()}`,
      weekStart,
      weekEnd,
      courseKey: course.key,
      reason: `This course covers ${courseSkills.join(", ")} which aligns with your goal to ${goal}.`,
      isTopic: false,
      skills: courseSkills,
      milestones: [`Confidently apply ${courseSkills.join(", ")} to real tasks.`],
    });
  }

  // Add a final suggested topic stage if we have room
  if (stages.length < maxStages) {
    const nextStageNum = stages.length + 1;
    const weekStart = stages.length * weeksPerStage + 1;
    const weekEnd = durationWeeks;

    stages.push({
      stageNumber: nextStageNum,
      title: `Advanced ${skills[0] || "Topics"} & Practice`,
      description: "Consolidate your learning with real-world projects and advanced concepts.",
      goal: "Apply your skills to practical projects and prepare for next steps.",
      weekStart,
      weekEnd,
      courseKey: null,
      reason: "No matching EduPro course available for this advanced topic.",
      isTopic: true,
    });
  }

  // If no candidates at all, the service returns the unavailable plan without
  // calling the provider. This branch is a safety net only.
  if (stages.length === 0) {
    stages.push({
      stageNumber: 1,
      title: normalizedGoal.role ? `Learning ${normalizedGoal.role}` : goal,
      description: "A suggested learning topic with no matching EduPro course yet.",
      goal: "Explore this topic through external resources.",
      weekStart: 1,
      weekEnd: durationWeeks,
      courseKey: null,
      reason: "No matching published EduPro course available.",
      isTopic: true,
    });
  }

  return {
    title: normalizedGoal.role
      ? `${normalizedGoal.role
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")} Foundations`
      : `Learning Path: ${goal}`,
    summary: `A personalized ${durationWeeks}-week path for ${goal} at ${ctx.level.toLowerCase()} level. Includes ${stages.filter((s) => !s.isTopic).length} EduPro courses and ${stages.filter((s) => s.isTopic).length} suggested topic(s).`,
    stages,
  };
}

/**
 * Creates a mock provider that simulates an LLM failure.
 * Useful for testing error handling.
 */
export function createFailingMockProvider(errorMessage = "Mock AI provider failed"): AIProvider {
  return createMockProvider({ shouldFail: true, errorMessage });
}