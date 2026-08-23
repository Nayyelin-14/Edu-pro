import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { getCourseForLearning } from "@/server/services/course.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { isEnrolled } from "@/server/services/enrollment.service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { courseId } = await params;
    const enrolled = await isEnrolled(ctx.user.id, courseId, ctx.tenant.id);
    if (!enrolled) return ok({ enrolled: false, course: null });
    const data = await getCourseForLearning(ctx, courseId);
    return ok({ enrolled: true, ...data });
  });
}
