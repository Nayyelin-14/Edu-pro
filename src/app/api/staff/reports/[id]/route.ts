import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { resolveReportSchema } from "@/lib/validation/report";
import { resolveReport } from "@/server/services/report.service";
import { isPlatformAdmin } from "@/server/authorization";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    const { id } = await params;
    const input = resolveReportSchema.parse(await parseBody(req));
    if (isPlatformAdmin(user)) {
      // PLATFORM MODE: SUPERADMIN resolves any report.
      return ok(await resolveReport(user.id, id, input.status));
    }
    // TENANT MODE: instructors resolve reports on their own courses only.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    return ok(await resolveReport(user.id, id, input.status, { tenantId: tctx.tenant.id }));
  });
}