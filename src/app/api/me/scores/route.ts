import { ok, run } from "@/lib/api";
import { getUserScores } from "@/server/services/user.service";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    // TENANT MODE: scores are scoped to the active tenant.
    const ctx = await requireTenantContext();
    return ok(await getUserScores(ctx.user.id, ctx.tenant.id));
  });
}
