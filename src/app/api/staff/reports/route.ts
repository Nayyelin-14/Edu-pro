import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listReports } from "@/server/services/report.service";
import { isPlatformAdmin } from "@/server/authorization";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";
import { reportsQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    if (isPlatformAdmin(user)) {
      // PLATFORM MODE: SUPERADMIN manages reports across all tenants.
      const query = reportsQuerySchema.parse({
        status: req.nextUrl.searchParams.get("status") || "ALL",
        page: 1,
        pageSize: 20,
      });
      return ok(await listReports(query, {}));
    }
    // TENANT MODE: instructors see reports on their own courses.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    const sp = req.nextUrl.searchParams;
    const query = reportsQuerySchema.parse({
      status: sp.get("status") || "ALL",
      page: sp.get("page") || 1,
      pageSize: sp.get("pageSize") || 20,
    });
    return ok(
      await listReports(query, {
        tenantId: tctx.tenant.id,
        instructorId: user.id,
      }),
    );
  });
}
