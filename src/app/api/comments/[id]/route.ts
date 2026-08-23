import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateCommentSchema } from "@/lib/validation/comment";
import { updateComment, deleteComment } from "@/server/services/comment.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    // TENANT MODE: only comments inside the active tenant are mutable.
    const ctx = await requireTenantContext();
    const { id } = await params;
    const input = updateCommentSchema.parse(await parseBody(req));
    return ok(await updateComment(ctx, id, input.content));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    // TENANT MODE: only comments inside the active tenant are mutable.
    const ctx = await requireTenantContext();
    const { id } = await params;
    return ok(await deleteComment(ctx, id));
  });
}
