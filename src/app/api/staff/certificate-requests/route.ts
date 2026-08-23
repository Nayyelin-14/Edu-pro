import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listCertificateRequests } from "@/server/services/certificate-request.service";
import { isPlatformAdmin } from "@/server/authorization";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

// Instructors list certificate requests for courses they own.
export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    const { searchParams } = new URL(req.url);
    const status =
      searchParams.get("status") === "PENDING" ||
      searchParams.get("status") === "APPROVED" ||
      searchParams.get("status") === "REJECTED"
        ? (searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED")
        : undefined;
    if (isPlatformAdmin(user)) {
      // PLATFORM MODE: SUPERADMIN sees every tenant's requests.
      return ok({ items: await listCertificateRequests({ userId: user.id }, status) });
    }
    // TENANT MODE: instructors see requests for their own courses.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    return ok({
      items: await listCertificateRequests(
        { tenantId: tctx.tenant.id, userId: user.id },
        status,
      ),
    });
  });
}