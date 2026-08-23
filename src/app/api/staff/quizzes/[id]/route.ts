import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateQuizSchema } from "@/lib/validation/course";
import { updateQuiz, deleteQuiz } from "@/server/services/admin.content.service";
import { assertQuizOwner, requireStaff, requireUser } from "@/server/guards";
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
    const ref = await assertQuizOwner(user, id, tctx);
    const input = updateQuizSchema.parse(await parseBody(req));
    return ok(await updateQuiz(id, input, ref.tenantId));
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
    const ref = await assertQuizOwner(user, id, tctx);
    await deleteQuiz(id, ref.tenantId);
    return ok({ success: true });
  });
}