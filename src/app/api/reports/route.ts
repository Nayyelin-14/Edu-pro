import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createReportSchema } from "@/lib/validation/report";
import { createReport, getMyReports } from "@/server/services/report.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    await enforceRateLimit(`reports:${ctx.user.id}`);
    const input = createReportSchema.parse(await parseBody(req));
    return ok(await createReport(ctx, input), { status: 201 });
  });
}

export async function GET() {
  return run(async () => {
    const ctx = await requireTenantContext();
    return ok({ reports: await getMyReports(ctx) });
  });
}
