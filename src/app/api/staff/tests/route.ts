import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createTestSchema } from "@/lib/validation/course";
import { createTest } from "@/server/services/admin.content.service";
import { assertCourseOwner, requireStaff, requireUser } from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    let tctx;
    if (!isPlatformAdmin(user)) {
      // TENANT MODE: instructors manage their own courses only.
      tctx = await requireTenantContext();
      requireTenantCapability(tctx, "author");
    }
    const input = createTestSchema.parse(await parseBody(req));
    const ref = await assertCourseOwner(user, input.courseId, tctx);
    return ok(await createTest(input), { status: 201 });
  });
}