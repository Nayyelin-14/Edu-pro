import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createReviewSchema } from "@/lib/validation/comment";
import { createReview, hasReviewed } from "@/server/services/review.service";
import { requireUser, requireVerified } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    await requireVerified(ctx.user);
    await enforceRateLimit(`reviews:${ctx.user.id}`);
    const input = createReviewSchema.parse(await parseBody(req));
    return ok(await createReview(ctx, input), { status: 201 });
  });
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) return ok({ review: null });
    return ok({ review: await hasReviewed(ctx, courseId) });
  });
}
