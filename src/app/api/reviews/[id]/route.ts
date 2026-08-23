import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateReviewSchema } from "@/lib/validation/comment";
import { updateReview } from "@/server/services/review.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    const input = updateReviewSchema.parse(await parseBody(req));
    return ok(await updateReview(ctx, id, input));
  });
}
