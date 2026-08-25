import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getNextItem } from "@/server/services/learning.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { isEnrolled } from "@/server/services/enrollment.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const ctx = await requireTenantContext();
    const { courseId } = await params;

    const enrolled = await isEnrolled(user.id, courseId, ctx.tenant.id);
    if (!enrolled) throw new ApiError(403, "Enroll in the course first");

    const itemId = req.nextUrl.searchParams.get("itemId");
    const itemType = req.nextUrl.searchParams.get("type");
    if (!itemId || (itemType !== "lesson" && itemType !== "quiz")) {
      throw new ApiError(400, "itemId and type (lesson|quiz) are required");
    }

    const result = await getNextItem(ctx, courseId, itemId, itemType);
    return ok(result);
  });
}

