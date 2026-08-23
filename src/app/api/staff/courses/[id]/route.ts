import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateCourseSchema } from "@/lib/validation/course";
import {
  updateCourse,
  deleteCourse,
  getAdminCourse,
} from "@/server/services/admin.course.service";
import { assertCourseOwner, requireStaff, requireUser } from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function GET(
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
    const ref = await assertCourseOwner(user, id, tctx);
    return ok(await getAdminCourse(id, ref.tenantId));
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    let tctx;
    if (!isPlatformAdmin(user)) {
      tctx = await requireTenantContext();
      requireTenantCapability(tctx, "author");
    }
    const { id } = await params;
    const ref = await assertCourseOwner(user, id, tctx);
    const input = updateCourseSchema.parse(await parseBody(req));
    // Only superadmins may feature/unfeature a course (platform decision).
    if (user.role !== "SUPERADMIN") delete input.isFeatured;
    return ok(await updateCourse(id, input, ref.tenantId));
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
      tctx = await requireTenantContext();
      requireTenantCapability(tctx, "author");
    }
    const { id } = await params;
    const ref = await assertCourseOwner(user, id, tctx);
    await deleteCourse(id, ref.tenantId);
    return ok({ success: true });
  });
}