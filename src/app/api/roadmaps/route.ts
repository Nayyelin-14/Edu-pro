import { ok, run } from "@/lib/api";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const ctx = await requireTenantContext();
    const [roadmaps, pendingDraft] = await Promise.all([
      roadmapReadRepo.getMyRoadmaps(ctx.user.id, ctx.tenant.id),
      roadmapReadRepo.getPendingDraft(ctx.user.id, ctx.tenant.id),
    ]);
    return ok({ roadmaps, pendingDraft });
  });
}