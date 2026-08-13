/**
 * AI provider abstraction for personalized learning-roadmap generation.
 *
 * The roadmap service depends on this interface (not a concrete provider), so
 * Gemini can be swapped for OpenAI/Anthropic/Ollama later without rewriting the
 * planner. The provider is ONLY responsible for producing a structured plan from
 * a prompt; it never writes to the database, never resolves course IDs, and never
 * validates user identity — those are owned by the server.
 */
import type { Course } from "@/generated/prisma/client";

/** A published course surfaced to the LLM as a recommendation candidate.
 *
 * `key` is a short, opaque, per-request token assigned by the server (e.g.
 * "cand-1"). It is the ONLY identity the LLM is allowed to reference — titles
 * are non-unique and renameable, so resolution against the real catalog always
 * goes through the key, never through title text. */
export interface CourseCandidate {
  key: string;
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  price: number;
  lessonCount: number;
  studentCount: number;
  rating: number;
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
  skills: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  durationWeeks: number;
  hoursPerWeek: number;
  language: "en" | "th";
  candidates: CourseCandidate[];
  progress: Map<string, CourseProgress>;
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
  /** Stable provider identifier, e.g. "gemini". */
  provider: string;
  /** Model identifier as configured, e.g. "gemini-2.0-flash". Null when unknown. */
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  usageSource: "provider_reported" | "calculated" | "unavailable";
}

/** Minimal contract every provider must implement. `usage` is optional: when a
 * provider can't report usage it is simply omitted and the server records
 * NULL/"unavailable". */
export interface AIProvider {
  generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan & { usage?: GenerationUsage }>;
}

/** Resolves a candidate course to its public-ish summary (for storage/return). */
export type { Course };
