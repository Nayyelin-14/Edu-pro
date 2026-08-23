import { run, ok } from "@/lib/api";
import { requireUser, requireStaff } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";
import {
  defaultNimModel,
  getModelCatalog,
  runNimBenchmark,
  saveModelCatalog,
} from "@/server/services/nim.models";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/models
 * Returns the ranked NIM model catalog (probed + benchmarked).
 * `?refresh=1` re-runs the full benchmark on demand (slow, expensive) and is
 * therefore restricted to staff with author capability in their active tenant.
 */
export async function GET(req: Request) {
  return run(async () => {
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    if (refresh) {
      await requireStaff(await requireUser());
      // TENANT MODE: only authors/admins may trigger benchmark spend.
      requireTenantCapability(await requireTenantContext(), "author");
    }

    let models = await getModelCatalog();
    if (refresh || models.length === 0) {
      models = await runNimBenchmark({ concurrency: 5 });
      await saveModelCatalog(models);
    }

    return ok({
      models,
      defaultModel: defaultNimModel(),
      refreshedAt: refresh ? new Date().toISOString() : null,
    });
  });
}
