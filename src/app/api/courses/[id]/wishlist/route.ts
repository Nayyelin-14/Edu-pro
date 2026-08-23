import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { toggleWishlist, isWishlisted } from "@/server/services/wishlist.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    return ok(await toggleWishlist(ctx, id));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    return ok(await toggleWishlist(ctx, id));
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    return ok({ saved: await isWishlisted(ctx, id) });
  });
}
