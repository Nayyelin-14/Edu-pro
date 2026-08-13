import { ok, run } from "@/lib/api";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    const roadmaps = await roadmapReadRepo.getMyRoadmaps(user.id);
    return ok({ roadmaps });
  });
}