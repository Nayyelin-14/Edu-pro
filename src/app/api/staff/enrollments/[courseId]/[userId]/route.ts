import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { deleteEnrollment } from "@/server/services/enrollment.service";
import { assertCourseOwner, requireStaff, requireUser } from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; userId: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    let tctx;
    if (!isPlatformAdmin(user)) {
      // TENANT MODE: instructors manage their own courses only.
      tctx = await requireTenantContext();
      requireTenantCapability(tctx, "author");
    }
    const { courseId, userId } = await params;
    const course = await assertCourseOwner(user, courseId, tctx);
    return ok(await deleteEnrollment(userId, courseId, course.tenantId));
  });
}