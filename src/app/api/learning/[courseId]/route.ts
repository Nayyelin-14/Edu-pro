import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { getCourseForLearning } from "@/server/services/course.service";
import { requireUser } from "@/server/guards";
import { isEnrolled } from "@/server/services/enrollment.service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const enrolled = await isEnrolled(user.id, courseId);
    if (!enrolled) return ok({ enrolled: false, course: null });
    const data = await getCourseForLearning(courseId, user.id);
    return ok({ enrolled: true, ...data });
  });
}
