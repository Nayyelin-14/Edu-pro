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
      const roadmap = await roadmapReadRepo.getMyRoadmap(user.id, job.roadmapId);
      if (roadmap) {
        return ok({ status: "COMPLETED", jobId: job.id, roadmap });
      }
    }

    if (job.status === "FAILED") {
      return ok({ status: "FAILED", jobId: job.id, errorCode: job.lastErrorCode });
    }

    return ok({ status: job.status, jobId: job.id });
  });
}