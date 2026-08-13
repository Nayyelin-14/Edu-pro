import { NextRequest, NextResponse } from "next/server";
import { ok, run } from "@/lib/api";
import { ApiError, payloadTooLarge, serviceUnavailable } from "@/lib/errors";
import { enforceRoadmapDailyQuota, enforceRoadmapRateLimit } from "@/lib/ratelimit";
import { generateRoadmapSchema } from "@/lib/validation/roadmap";
import { createDefaultGeminiProvider } from "@/lib/ai/gemini";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { RoadmapService, PrismaRoadmapRepo } from "@/server/services/roadmap.service";
import { createRoadmapPublisher, isQStashEnabled } from "@/server/services/roadmap.queue";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

// Keep request bodies small: the schema caps the goal at 500 chars, so anything
// larger than this is abuse (a full prompt would be replayed into the AI call).
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();

    await enforceRoadmapRateLimit(user.id);

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw payloadTooLarge("Request body exceeds 16 KB");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }
    const input = generateRoadmapSchema.parse(parsed);

    const repo = new PrismaRoadmapRepo();
    const qstashEnabled = isQStashEnabled();
    const service = new RoadmapService(createDefaultGeminiProvider(), createRoadmapPublisher());

    // One job per idempotency key; the daily quota is charged only for a NEW
    // accepted attempt, never for retries of an existing idempotent request.
    const created = await service.createJob(user.id, input, repo, {
      publish: qstashEnabled,
      beforeNewAttempt: () => enforceRoadmapDailyQuota(user.id),
    });

    if (created.status === "COMPLETED" && created.roadmapId) {
      const roadmap = await roadmapReadRepo.getMyRoadmap(user.id, created.roadmapId);
      return ok({ status: "COMPLETED", jobId: created.jobId, roadmap });
    }

    if (qstashEnabled) {
      // 202 Accepted: processing happens in the signed QStash worker. The
      // client polls GET /api/ai/roadmap/jobs/[jobId].
      return NextResponse.json(
        { isSuccess: true, data: { status: created.status, jobId: created.jobId } },
        { status: 202 },
      );
    }

    // Dev fallback (QSTASH_ENABLED=false): run the job inline so the app works
    // without QStash. Never the production path.
    const result = await service.processJob(created.jobId, repo);
    if (result.outcome === "completed") {
      const roadmap = await roadmapReadRepo.getMyRoadmap(user.id, result.roadmapId);
      return ok({ status: "COMPLETED", jobId: created.jobId, roadmap });
    }
    if (result.outcome === "retryable") {
      throw serviceUnavailable("Roadmap generation is temporarily unavailable. Please retry.");
    }
    throw new ApiError(502, "Roadmap generation failed. Please try again.");
  });
}