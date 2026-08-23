import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createQuizSchema } from "@/lib/validation/course";
import { createQuiz } from "@/server/services/admin.content.service";
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
    const input = createQuizSchema.parse(await parseBody(req));
    const ref = await assertModuleOwner(user, input.moduleId, tctx);
    return ok(await createQuiz(input), { status: 201 });
  });
}