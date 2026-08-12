import { ok, run } from "@/lib/api";
import { listWishlist } from "@/server/services/wishlist.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  return run(async () => {
    const user = await requireUser();
    return ok({ items: await listWishlist(user.id) });
  });
}
