import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { PrismaRoadmapRepo } from "@/server/services/roadmap.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

/** Job status for the roadmap owner. Never leaks another user's job. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;

    const job = await new PrismaRoadmapRepo().getJobById(id);
    if (!job || job.userId !== user.id) {
      // 404 (not 403) so existence is not leaked to other users.
      throw notFound();
    }

    if (job.status === "COMPLETED" && job.roadmapId) {
      // The job's tenantId was written server-side at enqueue time; scope the
      // roadmap fetch to it so a multi-tenant user cannot view the roadmap
      // from outside its tenant context.
      const roadmap = await roadmapReadRepo.getMyRoadmap(user.id, job.roadmapId, job.tenantId);
      if (roadmap) {
        return ok({ status: "COMPLETED", jobId: job.id, roadmap, progressStage: job.progressStage });
      }
    }

    if (job.status === "FAILED") {
      return ok({ status: "FAILED", jobId: job.id, errorCode: job.lastErrorCode, progressStage: job.progressStage });
    }

    return ok({
      status: job.status,
      jobId: job.id,
      progressStage: job.progressStage,
      interpretation: job.interpretation ?? null,
    });
  });
}