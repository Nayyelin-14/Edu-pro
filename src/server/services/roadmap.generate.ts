/**
 * Shared generation flow used by the goal-only POST route and the refinement
 * PATCH route. Encapsulates: apply defaults -> create idempotent job -> return
 * a completed roadmap (inline dev path) or a pollable job id (QStash path).
 */
import { NextResponse } from "next/server";
import { ok } from "@/lib/api";
import { ApiError, serviceUnavailable } from "@/lib/errors";
import { enforceRoadmapRateLimit } from "@/lib/ratelimit";
import { generateRoadmapSchema, type GenerateRoadmapInput, type RoadmapLevel, type ClarificationAnswerRaw } from "@/lib/validation/roadmap";
import { createDefaultProvider } from "@/lib/ai/nim";
import { normalizeGoal, applyClarificationAnswers, type GoalAnalysis, type ClarificationAnswer } from "@/lib/ai/retrieval";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { RoadmapService, PrismaRoadmapRepo, interpretGoalWithFallback } from "@/server/services/roadmap.service";
import { createRoadmapPublisher, isQStashEnabled } from "@/server/services/roadmap.queue";

const LOCALE_COOKIE = "elearning.locale";

/** A clarification question shown to the learner before a job is created. */
export interface ClarificationQuestion {
  id: string;
  question: string;
  type: "text" | "multiselect";
  hint?: string;
}

function tr(en: string, th: string, language: string): string {
  return language === "th" ? th : en;
}

/**
 * Is this goal genuinely ambiguous? A goal only needs clarification when it
 * carries NO interpretable signal at all (no role, no skills, no known skills,
 * no domain) — a "I want to learn things"-style statement. Specific goals
 * always generate immediately (hybrid: ask only when truly unclear, never a
 * hardcoded role allowlist).
 */
export function needsClarification(analysis: GoalAnalysis): boolean {
  const hasSignal =
    Boolean(analysis.roleId) ||
    analysis.skills.length > 0 ||
    analysis.knownSkills.length > 0 ||
    Boolean(analysis.domain);
  return !hasSignal && analysis.confidence < 0.5;
}

/** Build up to 3 tailored questions for the gaps in the interpretation. */
export function buildClarificationQuestions(
  analysis: GoalAnalysis,
  language: "en" | "th",
): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  if (!analysis.roleId) {
    questions.push({
      id: "role",
      question: tr(
        "Which role or career are you aiming for?",
        "คุณตั้งเป้าหมายสายงานหรืออาชีพใด?",
        language,
      ),
      type: "text",
      hint: tr("e.g. data engineer, frontend developer, data analyst", "เช่น data engineer, frontend developer, data analyst", language),
    });
  }
  if (analysis.skills.length === 0) {
    questions.push({
      id: "skills",
      question: tr(
        "What skills or topics do you want to learn?",
        "คุณต้องการเรียนรู้ทักษะหรือหัวข้อใด?",
        language,
      ),
      type: "multiselect",
      hint: tr("e.g. Python, database, React, API design", "เช่น Python, database, React, API design", language),
    });
  }
  if (questions.length < 3 && !analysis.domain) {
    questions.push({
      id: "technologies",
      question: tr(
        "Any specific technologies you want to focus on?",
        "มีเทคโนโลยีเฉพาะที่ต้องการเน้นหรือไม่?",
        language,
      ),
      type: "multiselect",
      hint: tr("e.g. AWS, Kubernetes, Docker", "เช่น AWS, Kubernetes, Docker", language),
    });
  }
  return questions;
}

/** Deterministic defaults so the learner only ever has to type a goal. */
export function applyRoadmapDefaults(
  parsed: {
    goal: string;
    level?: RoadmapLevel;
    durationWeeks?: number;
    hoursPerWeek?: number;
    language?: "en" | "th";
    model?: string;
    refresh?: boolean;
    answers?: ClarificationAnswerRaw[];
  },
  localeCookie: string | null,
): GenerateRoadmapInput {
  const normalized = normalizeGoal(parsed.goal);
  const language = parsed.language ?? (localeCookie === "th" ? "th" : "en");
  return {
    goal: parsed.goal,
    level: parsed.level ?? normalized.level,
    durationWeeks: parsed.durationWeeks ?? 12,
    hoursPerWeek: parsed.hoursPerWeek ?? 8,
    language,
    model: parsed.model,
    refresh: parsed.refresh,
    answers: parsed.answers,
  };
}

export interface GenerateFlowResult {
  status: "COMPLETED" | "QUEUED" | "PROCESSING" | "NEEDS_CLARIFICATION";
  jobId: string;
  roadmap?: Awaited<ReturnType<typeof roadmapReadRepo.getMyRoadmap>>;
  questions?: ClarificationQuestion[];
  interpretation?: GoalAnalysis;
}

/** Create a job for the given (validated) input and return the flow result. */
export async function startRoadmapGeneration(
  userId: string,
  input: GenerateRoadmapInput,
  /** Trusted tenant from TenantContext — REQUIRED, never client input. */
  tenantId: string,
): Promise<GenerateFlowResult> {
  await enforceRoadmapRateLimit(userId);
  const repo = new PrismaRoadmapRepo();
  const qstashEnabled = isQStashEnabled();
  const provider = createDefaultProvider(input.model);
  const service = new RoadmapService(provider, createRoadmapPublisher());

  // Call #1: interpret the goal (AI with deterministic fallback). Stored on the
  // job so the worker reuses it and never re-interprets (never doubles the AI
  // budget). Also the source of the clarification decision.
  let analysis = await interpretGoalWithFallback(provider, input.goal, input.language ?? "en");

  // Follow-up answers (from a previous NEEDS_CLARIFICATION) are merged into the
  // interpretation deterministically — no second AI call.
  if (input.answers && input.answers.length > 0) {
    const answers: ClarificationAnswer[] = input.answers.map((a: ClarificationAnswerRaw) => ({
      id: a.id,
      value: a.value,
    }));
    analysis = applyClarificationAnswers(analysis, answers);
  }

  // Hybrid clarification: ask only when the goal is genuinely ambiguous AND the
  // learner has not already answered. Never a hardcoded role allowlist.
  if (needsClarification(analysis) && (!input.answers || input.answers.length === 0)) {
    return {
      status: "NEEDS_CLARIFICATION",
      jobId: "",
      interpretation: analysis,
      questions: buildClarificationQuestions(analysis, input.language ?? "en"),
    };
  }

  const created = await service.createJob(userId, input, repo, {
    publish: qstashEnabled,
    interpretation: analysis,
    tenantId,
  });

  if (created.status === "COMPLETED" && created.roadmapId) {
    const roadmap = await roadmapReadRepo.getMyRoadmap(userId, created.roadmapId, tenantId);
    return { status: "COMPLETED", jobId: created.jobId, roadmap: roadmap ?? undefined };
  }

  if (qstashEnabled) {
    return { status: created.status === "FAILED" ? "QUEUED" : created.status, jobId: created.jobId };
  }

  // Dev fallback: run the job inline so the app works without QStash.
  const result = await service.processJob(created.jobId, repo);
  if (result.outcome === "completed") {
    const roadmap = await roadmapReadRepo.getMyRoadmap(userId, result.roadmapId, tenantId);
    return { status: "COMPLETED", jobId: created.jobId, roadmap: roadmap ?? undefined };
  }
  if (result.outcome === "retryable") {
    throw serviceUnavailable("Roadmap generation is temporarily unavailable. Please retry.");
  }
  throw new ApiError(502, "Roadmap generation failed. Please try again.");
}

/** Render the flow result as a NextResponse (202 for async, 200 for done). */
export function renderGenerationResult(result: GenerateFlowResult): NextResponse {
  if (result.status === "COMPLETED" && result.roadmap) {
    return ok({ status: "COMPLETED", jobId: result.jobId, roadmap: result.roadmap });
  }
  if (result.status === "NEEDS_CLARIFICATION") {
    return ok({
      status: "NEEDS_CLARIFICATION",
      questions: result.questions ?? [],
      interpretation: result.interpretation ?? null,
    });
  }
  return NextResponse.json(
    { isSuccess: true, data: { status: result.status, jobId: result.jobId } },
    { status: 202 },
  );
}

export { LOCALE_COOKIE, generateRoadmapSchema };