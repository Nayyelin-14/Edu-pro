import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { deleteEnrollment } from "@/server/services/enrollment.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; userId: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { courseId, userId } = await params;
    return ok(await deleteEnrollment(userId, courseId));
  });
}
