import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { confirmOrder } from "@/server/services/order.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

// Confirms the purchase when the user returns from Stripe (webhook may not
// have fired yet) and grants enrollment for paid orders.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    return ok(await confirmOrder(ctx, id));
  });
}