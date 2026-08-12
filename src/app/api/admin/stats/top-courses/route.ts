import { ok, run } from "@/lib/api";
import { getTopCourses } from "@/server/services/stats.service";
import { requireStaff, requireUser } from "@/server/guards";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return run(async () => {
    await requireStaff(await requireUser());
    const url = new URL(req.url);
    const query = querySchema.parse({
      limit: url.searchParams.get("limit") || 3,
    });
    return ok(await getTopCourses(query.limit));
  });
}