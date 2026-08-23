import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateLessonSchema } from "@/lib/validation/course";
import { updateLesson, deleteLesson } from "@/server/services/admin.course.service";
import { assertLessonOwner, requireStaff, requireUser } from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
        let tctx;
        if (!isPlatformAdmin(user)) {
          // TENANT MODE: instructors manage their own courses only.
          tctx = await requireTenantContext();
          requireTenantCapability(tctx, "author");
        }
    const { id } = await params;
    const ref = await assertLessonOwner(user, id, tctx);
    const input = updateLessonSchema.parse(await parseBody(req));
    return ok(await updateLesson(id, input, ref.tenantId));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    let tctx;
    if (!isPlatformAdmin(user)) {
      // TENANT MODE: instructors manage their own courses only.
      tctx = await requireTenantContext();
      requireTenantCapability(tctx, "author");
    }
    const { id } = await params;
    const ref = await assertLessonOwner(user, id, tctx);
    await deleteLesson(id, ref.tenantId);
    return ok({ success: true });
  });
}