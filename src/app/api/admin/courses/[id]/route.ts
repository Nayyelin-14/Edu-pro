import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateCourseSchema } from "@/lib/validation/course";
import {
  updateCourse,
  deleteCourse,
  getAdminCourse,
} from "@/server/services/admin.course.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    return ok(await getAdminCourse(id));
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    const input = updateCourseSchema.parse(await parseBody(req));
    return ok(await updateCourse(id, input));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    await deleteCourse(id);
    return ok({ success: true });
  });
}
