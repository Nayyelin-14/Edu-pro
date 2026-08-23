import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { getEnrollmentStatus } from "@/server/services/enrollment.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    return ok(await getEnrollmentStatus(ctx, id));
  });
}
