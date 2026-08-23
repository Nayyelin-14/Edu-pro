/**
 * React Query hooks for roadmap data.
 * Follows the existing pattern of using apiFetch directly in components.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface RoadmapSummary {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: string;
  status: string;
  saved: boolean;
  catalogCoverage: string;
  missingSkills: string[];
  shortExplanation: string | null;
  goalCoverage: number;
  courseAvailability: number;
  roadmapQuality: string;
  confidence: number;
  assumptions: string[];
  totalStages: number;
  matchedStages: number;
  completedStages: number;
  progressPercent: number;
  estimatedDuration: number;
  nextAction: {
    type: "start" | "continue" | "complete" | "none";
    courseId?: string;
    courseTitle?: string;
    courseSlug?: string | null;
  };
}

export interface RoadmapItemDetail {
  id: string;
  stageNumber: number;
  title: string;
  description: string | null;
  goal: string | null;
  weekStart: number;
  weekEnd: number;
  courseId: string | null;
  courseTitle: string | null;
  courseReason: string | null;
  courseSlug: string | null;
  status: string;
  isTopic: boolean;
  skills: string[];
  milestones: string[];
  estimatedWeeks: number;
  matchQuality: string | null;
  matchedCompetencies: string[];
  courseProgress: {
    percent: number;
    completedLessons: number;
    totalLessons: number;
  } | null;
}

export interface CoverageBreakdownView {
  goalCoverage: number;
  courseAvailability: number;
  skills: Array<{
    skill: string;
    importance: "critical" | "important" | "optional";
    category: "foundational" | "core" | "advanced";
    status: "complete" | "partial" | "weak" | "unavailable";
    reason: string;
    quality: "excellent" | "good" | "partial" | "insufficient";
    matchedCourseIds: string[];
    catalogCourseIds: string[];
  }>;
}

export interface RoadmapGenerationInfo {
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  generatedAt: string | null;
  usageSource: "provider_reported" | "calculated" | "unavailable" | null;
  attemptCount: number | null;
  retryCount: number | null;
}

export interface RoadmapDetail extends Omit<RoadmapSummary, "nextAction"> {
  nextAction: RoadmapSummary["nextAction"];
  items: RoadmapItemDetail[];
  coverageBreakdown: CoverageBreakdownView | null;
  generation: RoadmapGenerationInfo;
  /** Server-side interpretation + competency model the path was built against. */
  interpretation: {
    goalAnalysis: {
      role: string | null;
      roleId: string | null;
      roleSource: "profile" | "general" | "none" | null;
      roleConfidence: number;
      domain: string | null;
      domainConfidence: number;
      confidence: number;
      assumptions: string[];
      skills: string[];
      knownSkills: string[];
      level: string | null;
    } | null;
    requiredSkills: Array<{
      skill: string;
      importance: "critical" | "important" | "optional";
      category: "foundational" | "core" | "advanced";
      source: "profile" | "goal";
      prerequisites?: string[];
    }> | null;
  } | null;
}

export interface GenerateRoadmapInput {
  goal: string;
  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  durationWeeks?: number;
  hoursPerWeek?: number;
  language?: "en" | "th";
  model?: string;
  refresh?: boolean;
  /** Follow-up answers to a NEEDS_CLARIFICATION response (max 3). */
  answers?: Array<{ id: string; value: string }>;
}

/** A clarification question the learner must answer before generation. */
export interface ClarificationQuestion {
  id: string;
  question: string;
  type: "text" | "multiselect";
  hint?: string;
}

/** Honest interpretation preview surfaced while generating / before answering. */
export interface GoalInterpretationPreview {
  role: string | null;
  roleId: string | null;
  domain: string | null;
  confidence: number;
  assumptions: string[];
  skills: string[];
  knownSkills: string[];
}

/** Real backend progress stages written by the worker. */
export type ProgressStage =
  | "interpreting"
  | "clarifying"
  | "retrieving"
  | "generating"
  | "validating"
  | "finalizing"
  | "completed"
  | "failed";

export interface GenerateRoadmapResult {
  status: "COMPLETED" | "QUEUED" | "PROCESSING" | "NEEDS_CLARIFICATION";
  jobId: string;
  roadmap?: RoadmapDetail;
  questions?: ClarificationQuestion[];
  interpretation?: GoalInterpretationPreview;
}

export interface RoadmapJobStatus {
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  jobId: string;
  roadmap?: RoadmapDetail;
  errorCode?: string | null;
  progressStage?: ProgressStage | null;
  interpretation?: GoalInterpretationPreview | null;
}

const ROADMAPS_KEY = ["roadmaps"] as const;
const ROADMAP_KEY = (id: string) => ["roadmap", id] as const;
const ROADMAP_JOB_KEY = (id: string) => ["roadmap-job", id] as const;

export function useRoadmaps() {
  return useQuery({
    queryKey: ROADMAPS_KEY,
    queryFn: () =>
      apiFetch<{ roadmaps: RoadmapSummary[]; pendingDraft: RoadmapSummary | null }>(
        "/api/roadmaps",
      ),
    select: (data) => data,
  });
}

export function useRoadmap(id: string | null) {
  return useQuery({
    queryKey: ROADMAP_KEY(id ?? ""),
    queryFn: () => apiFetch<{ roadmap: RoadmapDetail }>(`/api/roadmaps/${id}`),
    select: (data) => data.roadmap,
    enabled: !!id,
  });
}

export interface NimModelInfo {
  id: string;
  displayName: string;
  working: boolean;
  avgLatencyMs: number;
  avgTokens: number;
  qualityScore: number;
  score: number;
  recommended: boolean;
}

export interface NimModelCatalog {
  models: NimModelInfo[];
  defaultModel: string;
}

/** Maps the ranked catalog to the shape the model picker expects. */
export function toNimModelOptions(
  models: NimModelInfo[],
): Array<{ id: string; displayName: string; recommended: boolean }> {
  return models
    .filter((m) => m.working)
    .map((m) => ({ id: m.id, displayName: m.displayName, recommended: m.recommended }));
}

export function useNimModels() {
  return useQuery({
    queryKey: ["nim-models"],
    queryFn: () => apiFetch<NimModelCatalog>("/api/ai/models"),
    staleTime: 30 * 60_000,
  });
}

export function useGenerateRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateRoadmapInput) =>
      apiFetch<GenerateRoadmapResult>("/api/ai/roadmap", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
      if (data.roadmap?.id) {
        qc.invalidateQueries({ queryKey: ROADMAP_KEY(data.roadmap.id) });
      }
    },
  });
}

/** Polls an async generation job (QUEUED/PROCESSING) until it completes or fails. */
export function useRoadmapJob(jobId: string | null) {
  return useQuery({
    queryKey: ROADMAP_JOB_KEY(jobId ?? ""),
    queryFn: () => apiFetch<RoadmapJobStatus>(`/api/ai/roadmap/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: 3000,
  });
}

export function useDeleteRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/roadmaps/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
    },
  });
}

export function useSaveRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ roadmap: RoadmapDetail }>(`/api/roadmaps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "save" }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
      qc.invalidateQueries({ queryKey: ROADMAP_KEY(data.roadmap.id) });
    },
  });
}

export interface RoadmapRefinements {
  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  durationWeeks?: number;
  hoursPerWeek?: number;
}

/** Refines an existing saved path by regenerating from the same goal. */
export function useRefineRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; refinements: RoadmapRefinements }) =>
      apiFetch<GenerateRoadmapResult>(`/api/roadmaps/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "refine", refinements: input.refinements }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
      if (data.roadmap?.id) {
        qc.invalidateQueries({ queryKey: ROADMAP_KEY(data.roadmap.id) });
      }
    },
  });
}

/** Discards a draft (delete only when not saved). */
export function useDiscardRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/roadmaps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "discard" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
    },
  });
}