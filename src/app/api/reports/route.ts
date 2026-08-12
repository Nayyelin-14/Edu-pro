import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createReportSchema } from "@/lib/validation/report";
import { createReport, getMyReports } from "@/server/services/report.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const input = createReportSchema.parse(await parseBody(req));
    return ok(await createReport(user.id, input), { status: 201 });
  });
}

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok({ reports: await getMyReports(user.id) });
  });
}
