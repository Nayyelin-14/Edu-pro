import { apiFetch } from "@/lib/api-client";
import type { RoadmapDetail, RoadmapJobStatus } from "@/hooks/use-roadmaps";

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Poll an async roadmap generation job until it finishes.
 * Resolves the roadmap when the job COMPLETES, or null when it FAILS or the
 * timeout elapses. Shared by the generate form and the detail-page regenerate
 * so the poll loop lives in exactly one place.
 */
export async function waitForRoadmapJob(
  jobId: string,
  opts: PollOptions = {},
): Promise<RoadmapDetail | null> {
  const { intervalMs = 3000, timeoutMs = 180_000 } = opts;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const res = await apiFetch<RoadmapJobStatus>(`/api/ai/roadmap/jobs/${jobId}`);
    if (res.status === "COMPLETED" && res.roadmap?.id) return res.roadmap;
    if (res.status === "FAILED") return null;
    if (Date.now() > deadline) return null;
  }
}