import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { resolveReportSchema } from "@/lib/validation/report";
import { resolveReport } from "@/server/services/report.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const admin = await requireStaff(await requireUser());
    const { id } = await params;
    const input = resolveReportSchema.parse(await parseBody(req));
    return ok(await resolveReport(admin.id, id, input.status));
  });
}
