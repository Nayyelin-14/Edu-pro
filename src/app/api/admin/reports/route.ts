import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listReports } from "@/server/services/report.service";
import { requireStaff, requireUser } from "@/server/guards";
import { reportsQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const sp = req.nextUrl.searchParams;
    const query = reportsQuerySchema.parse({
      status: sp.get("status") || "ALL",
      page: sp.get("page") || 1,
      pageSize: sp.get("pageSize") || 20,
    });
    return ok(await listReports(query));
  });
}
