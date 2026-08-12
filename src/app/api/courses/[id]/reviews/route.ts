import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { listCourseReviews } from "@/server/services/review.service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const { id } = await params;
    return ok({ reviews: await listCourseReviews(id) });
  });
}
