import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { setCourseStatus } from "@/server/services/admin.course.service";
import { assertCourseOwner, requireStaff, requireUser } from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

// Owner moves their own course back to draft (unpublishes it).
export async function POST(
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
    return ok(await setCourseStatus(id, "DRAFT", ref.tenantId));
  });
}