import { NextRequest } from "next/server";
import { run, ok } from "@/lib/api";
import { unauthorized, serviceUnavailable } from "@/lib/errors";
import { createDefaultGeminiProvider } from "@/lib/ai/gemini";
import { RoadmapService, PrismaRoadmapRepo } from "@/server/services/roadmap.service";
import {
  acquireRoadmapSlot,
  createRoadmapPublisher,
  releaseRoadmapSlot,
  verifyQStashSignature,
} from "@/server/services/roadmap.queue";

export const dynamic = "force-dynamic";

/**
 * Public-but-signed worker invoked by Upstash QStash. Rejects anything without
 * a valid Upstash-Signature header, so users cannot trigger arbitrary jobs.
 * The job id comes from the signed payload; the (userId, fingerprint) claim
 * guarantees idempotency even if QStash delivers duplicates.
 */
export async function POST(req: NextRequest) {
  return run(async () => {
    const signature = req.headers.get("upstash-signature") ?? "";
    const body = await req.text();

    if (!(await verifyQStashSignature(signature, body))) {
      throw unauthorized("Invalid QStash signature");
    }

    let payload: { jobId?: unknown };
    try {
      payload = JSON.parse(body) as { jobId?: unknown };
    } catch {
      throw unauthorized("Malformed payload");
    }
    if (typeof payload.jobId !== "string") {
      throw unauthorized("Missing jobId");
    }

    // Bounded provider concurrency: when at the cap, return 503 so QStash
    // retries later instead of bursting Gemini on the free tier.
    if (!(await acquireRoadmapSlot())) {
      throw serviceUnavailable("Roadmap generation is at capacity. Retrying.");
    }

    try {
      const service = new RoadmapService(createDefaultGeminiProvider(), createRoadmapPublisher());
      const result = await service.processJob(payload.jobId, new PrismaRoadmapRepo());
      return ok({ jobId: payload.jobId, result });
    } finally {
      await releaseRoadmapSlot();
    }
  });
}