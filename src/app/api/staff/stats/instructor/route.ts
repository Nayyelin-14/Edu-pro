import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { getInstructorAnalytics } from "@/server/services/stats.service";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

// Analytics scoped to the signed-in instructor's own courses INSIDE the
// active tenant. Non-staff users are rejected by requireStaff; users without
// an active membership or author capability are rejected by the tenant gates.
export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    // TENANT MODE: analytics never span tenants.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    return ok(await getInstructorAnalytics(user.id, tctx.tenant.id));
  }, { req });
}