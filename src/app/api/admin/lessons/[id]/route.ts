import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateLessonSchema } from "@/lib/validation/course";
import { updateLesson, deleteLesson } from "@/server/services/admin.course.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    const input = updateLessonSchema.parse(await parseBody(req));
    return ok(await updateLesson(id, input));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    await deleteLesson(id);
    return ok({ success: true });
  });
}
