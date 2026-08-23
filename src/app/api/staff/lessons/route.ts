import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createLessonSchema } from "@/lib/validation/course";
import { createLesson } from "@/server/services/admin.course.service";
import { assertModuleOwner, requireStaff, requireUser } from "@/server/guards";
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
    const input = createLessonSchema.parse(await parseBody(req));
    const ref = await assertModuleOwner(user, input.moduleId, tctx);
    return ok(await createLesson(input), { status: 201 });
  });
}