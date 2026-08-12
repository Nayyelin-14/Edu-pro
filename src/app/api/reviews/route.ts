import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createReviewSchema } from "@/lib/validation/comment";
import { createReview, hasReviewed } from "@/server/services/review.service";
import { requireUser, requireVerified } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireVerified(await requireUser());
    const input = createReviewSchema.parse(await parseBody(req));
    return ok(await createReview(user.id, input), { status: 201 });
  });
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) return ok({ review: null });
    return ok({ review: await hasReviewed(user.id, courseId) });
  });
}
