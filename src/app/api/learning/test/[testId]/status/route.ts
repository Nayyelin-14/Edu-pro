import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { getTestStatus } from "@/server/services/test.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { testId } = await params;
    return ok(await getTestStatus(ctx, testId));
  });
}
