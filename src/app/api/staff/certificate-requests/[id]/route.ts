import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { z } from "zod";
import { decideCertificateRequest } from "@/server/services/certificate-request.service";
import { isPlatformAdmin } from "@/server/authorization";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

const decideSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
});

// Course instructor approves or rejects a student's certificate request.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    const { id } = await params;
    const input = decideSchema.parse(await parseBody(req));
    if (isPlatformAdmin(user)) {
      // PLATFORM MODE: SUPERADMIN decides any request.
      return ok(await decideCertificateRequest(user.id, id, input.action));
    }
    // TENANT MODE: instructors decide requests for their own courses only.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    return ok(
      await decideCertificateRequest(user.id, id, input.action, {
        tenantId: tctx.tenant.id,
      }),
    );
  });
}