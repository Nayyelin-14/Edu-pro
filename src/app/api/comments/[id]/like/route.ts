import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { toggleCommentLike } from "@/server/services/comment.service";
import { requireUser, requireVerified } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    await requireVerified(ctx.user);
    const { id } = await params;
    return ok(await toggleCommentLike(ctx, id));
  }, { req });
}