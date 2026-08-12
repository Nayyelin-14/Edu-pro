import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { toggleWishlist, isWishlisted } from "@/server/services/wishlist.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await toggleWishlist(user.id, id));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await toggleWishlist(user.id, id));
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok({ saved: await isWishlisted(user.id, id) });
  });
}
