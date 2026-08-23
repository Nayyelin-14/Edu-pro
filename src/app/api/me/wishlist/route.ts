import { ok, run } from "@/lib/api";
import { listWishlist } from "@/server/services/wishlist.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const ctx = await requireTenantContext();
    return ok({ items: await listWishlist(ctx) });
  });
}
