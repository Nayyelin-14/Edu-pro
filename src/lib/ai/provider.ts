/**
 * AI provider abstraction for personalized learning-path generation.
 *
 * The roadmap service depends on this interface (not a concrete provider), so
 * * NIM can be swapped for OpenAI/Anthropic/Ollama later without rewriting the
 * planner. The provider is ONLY responsible for producing a structured plan from
 * a prompt; it never writes to the database, never resolves course IDs, and never
 * validates user identity — those are owned by the server.
 */
import type { Course } from "@/generated/prisma/client";
import type { Importance } from "@/lib/ai/retrieval";

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/** A published course surfaced to the LLM as a recommendation candidate.
 *
 * `key` is a short, opaque, per-request token assigned by the server (e.g.
 * "cand-1"). It is the ONLY identity the LLM is allowed to reference — titles
 * are non-unique and renameable, so resolution against the real catalog always
 * goes through the key, never through title text.
 *
 * `skills`, `prerequisites`, `difficulty` and `estimatedHours` are real
 * database values; the LLM is instructed to treat them as facts, never to
 * invent them. */
export interface CourseCandidate {
  key: string;
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  price: number;
  studentCount: number;
  rating: number;
  difficulty?: Difficulty;
  skills?: string[];
  prerequisites?: string[];
  estimatedHours?: number | null;
  /** Which required competencies this course demonstrably covers (from the
   * server's retrieval scoring — never from the AI). Shown in the UI as the
   * "Why this course?" evidence and given to the planner so it can order and
   * justify real matches honestly. */
  matchedCompetencies?: string[];
  /** Server-computed match quality for this candidate vs the required
   * competencies. The planner may only recommend a course as a confident match
   * when this is DIRECT or STRONG; weaker matches must be flagged as partial. */
  matchType?: "DIRECT" | "STRONG" | "RELATED" | "WEAK" | "IRRELEVANT";
}

/** The user's learning state for a candidate course, computed from existing
 * Enrollment / CompletedLesson data. Never trusted from the AI. */
export interface CourseProgress {
  courseId: string;
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  completed: boolean;
}

/** All context the planner needs from the rest of the system. */
export interface PlannerContext {
  goal: string;
  /** Normalized goal interpretation produced by deterministic rules. */
  normalizedGoal: {
    role: string | null;
    skills: string[];
    level: Difficulty;
    outcome: string;
  };
  skills: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  durationWeeks: number;
  hoursPerWeek: number;
  language: "en" | "th";
  candidates: CourseCandidate[];
  progress: Map<string, CourseProgress>;
  /** Deterministic interpretation the planner must respect. The AI refines
   * stage content but never overrides these requirements. */
  interpretation: {
    role: string | null;
    domain: string | null;
    confidence: number;
    assumptions: string[];
    requiredSkills: Array<{
      skill: string;
      importance: "critical" | "important" | "optional";
      category: "foundational" | "core" | "advanced";
      prerequisites?: string[];
      source: "profile" | "goal";
    }>;
    coveragePreview: {
      goalCoverage: number;
      courseAvailability: number;
      skills: Array<{
        skill: string;
        importance: "critical" | "important" | "optional";
        status: "complete" | "partial" | "weak" | "unavailable";
        reason: string;
        quality: string;
        matchedCourseIds: string[];
        catalogCourseIds: string[];
      }>;
    };
  };
}

export interface AIRoadmapStageInput {
  stageNumber: number;
  title: string;
  description: string | null;
  goal: string | null;
  weekStart: number;
  weekEnd: number;
  /** Opaque candidate key (must be one of the keys from the catalog passed to
   * the provider), or null for a suggested topic. Resolved to a real course id
   * by the server. */
  courseKey: string | null;
  reason: string | null;
  isTopic: boolean;
  /** Skills the learner gains at this stage (validated server-side). */
  skills?: string[];
  /** What the learner should be able to do after this stage. */
  milestones?: string[];
}

/** A stage resolved against the real catalog by the server. */
export interface ResolvedRoadmapStage {
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

export interface AIRoadmapPlan {
  title: string;
  summary: string;
  stages: AIRoadmapStageInput[];
}

/** Durable generation metadata reported by a provider (or derived by the server).
 * Token counts and `source` are nullable-free: unknown means the provider did
 * not report usage, and the server persists NULL (never 0). */
export interface GenerationUsage {
  /** Stable provider identifier, e.g. "nim". */
  provider: string;
  /** Model identifier as configured, e.g. "meta/llama-3.3-70b-instruct". Null when unknown. */
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  usageSource: "provider_reported" | "calculated" | "unavailable";
}

/** A learner-goal interpretation produced by the AI (call #1 of the 2-call
 * budget). Shape mirrors the deterministic GoalAnalysis so the two are fully
 * interchangeable; the server validates it with zod and falls back to the
 * deterministic analyzer whenever the AI is absent, slow or invalid. */
export interface GoalInterpretation {
  role: string | null;
  roleId: string | null;
  roleSource: "profile" | "general" | "none";
  roleConfidence: number;
  domain: string | null;
  domainConfidence: number;
  /** Skills the learner explicitly wants to LEARN (from "learn X" regions). */
  skills: string[];
  /** Skills the learner already stated they KNOW. Never re-taught. */
  knownSkills: string[];
  level: Difficulty;
  /** 0..1 interpretation confidence. */
  confidence: number;
  assumptions: string[];
  /** What the student wants to become/achieve (e.g. "a YouTuber"). */
  target: string | null;
  /** Intended outcome / end state (e.g. "grow an audience on YouTube"). */
  outcome: string | null;
  /** Free-form competency model derived from understanding the goal — independent of catalog. */
  competencies: Array<{ name: string; rationale?: string | null; importance: Importance }>;
  /** Whether an important decision is missing (independent of retrieval). */
  ambiguity: { isAmbiguous: boolean; gaps: string[]; reason?: string | null };
}

/** Minimal contract every provider must implement. `usage` is optional: when a
 * provider can't report usage it is simply omitted and the server records
 * NULL/"unavailable". `interpretGoal` is optional: when absent (or on any
 * failure) the server falls back to the deterministic goal analyzer, so goal
 * understanding never blocks roadmap generation. */
export interface AIProvider {
  generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan & { usage?: GenerationUsage }>;
  interpretGoal?(input: { goal: string; language: "en" | "th" }): Promise<GoalInterpretation>;
}

/** Resolves a candidate course to its public-ish summary (for storage/return). */
export type { Course };