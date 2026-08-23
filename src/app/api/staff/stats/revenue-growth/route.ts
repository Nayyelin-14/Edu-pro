import { ok, run } from "@/lib/api";
import { getRevenueGrowth } from "@/server/services/stats.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";
import { z } from "zod";

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    const url = new URL(req.url);
    const query = querySchema.parse({
      months: url.searchParams.get("months") || 6,
    });
    return ok(await getRevenueGrowth(query.months));
  });
}