import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { startCheckout } from "@/server/services/order.service";
import { requireUser, requireVerified } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

// Starts (or resumes) a Stripe Checkout session for a paid course. Free
// courses enroll immediately and return checkoutUrl: null.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    await requireVerified(ctx.user);
    const { id } = await params;
    return ok(await startCheckout(ctx, id));
  }, { req });
}