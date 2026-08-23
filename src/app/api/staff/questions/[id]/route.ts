import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { deleteQuestion } from "@/server/services/admin.content.service";
import {
  assertQuizOwner,
  assertTestOwner,
  requireStaff,
  requireUser,
} from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function DELETE(
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
    const body = await parseBody<{ targetType?: "quiz" | "test"; targetId?: string }>(req);
    if (!body.targetType || !body.targetId) {
      throw badRequest("targetType and targetId are required");
    }
    const ref =
      body.targetType === "quiz"
        ? await assertQuizOwner(user, body.targetId, tctx)
        : await assertTestOwner(user, body.targetId, tctx);
    return ok(
      await deleteQuestion(
        { type: body.targetType, id: body.targetId },
        id,
        ref.tenantId,
      ),
    );
  });
}