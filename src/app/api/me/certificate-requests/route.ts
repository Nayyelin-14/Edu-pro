import { ok, run } from "@/lib/api";
import { getMyCertificateRequests } from "@/server/services/certificate-request.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

// A student's certificate request history (pending / approved / rejected).
export async function GET() {
  return run(async () => {
    const ctx = await requireTenantContext();
    return ok({ items: await getMyCertificateRequests(ctx) });
  });
}