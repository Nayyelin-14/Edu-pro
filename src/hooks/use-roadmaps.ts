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
  totalStages: number;
  matchedStages: number;
  completedStages: number;
  progressPercent: number;
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
  courseProgress: {
    percent: number;
    completedLessons: number;
    totalLessons: number;
  } | null;
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

export interface RoadmapDetail {
  id: string;
  title: string;
  goal: string;
  level: string;
  durationWeeks: number;
  hoursPerWeek: number;
  language: string;
  createdAt: string;
  totalStages: number;
  matchedStages: number;
  completedStages: number;
  progressPercent: number;
  saved: boolean;
  items: RoadmapItemDetail[];
  generation: RoadmapGenerationInfo;
}

export interface GenerateRoadmapInput {
  goal: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  durationWeeks: number;
  hoursPerWeek: number;
  language?: "en" | "th";
}

export interface GenerateRoadmapResult {
  status: "COMPLETED" | "QUEUED" | "PROCESSING";
  jobId: string;
  roadmap?: RoadmapDetail;
}

export interface RoadmapJobStatus {
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  jobId: string;
  roadmap?: RoadmapDetail;
  errorCode?: string | null;
}

const ROADMAPS_KEY = ["roadmaps"] as const;
const ROADMAP_KEY = (id: string) => ["roadmap", id] as const;
const ROADMAP_JOB_KEY = (id: string) => ["roadmap-job", id] as const;

export function useRoadmaps() {
  return useQuery({
    queryKey: ROADMAPS_KEY,
    queryFn: () => apiFetch<{ roadmaps: RoadmapSummary[] }>("/api/roadmaps"),
    select: (data) => data.roadmaps,
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
      apiFetch<{ roadmap: RoadmapDetail }>(`/api/roadmaps/${id}`, { method: "PATCH" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
      qc.invalidateQueries({ queryKey: ROADMAP_KEY(data.roadmap.id) });
    },
  });
}