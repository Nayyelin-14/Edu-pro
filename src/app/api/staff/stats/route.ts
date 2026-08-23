import { ok, run } from "@/lib/api";
import { getDashboardStats } from "@/server/services/stats.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    return ok(await getDashboardStats());
  });
}
