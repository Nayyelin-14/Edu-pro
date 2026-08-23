import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { enroll } from "@/server/services/enrollment.service";
import { requireUser, requireVerified } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    await requireVerified(ctx.user);
    const { id } = await params;
    return ok(await enroll(ctx, id));
  });
}
