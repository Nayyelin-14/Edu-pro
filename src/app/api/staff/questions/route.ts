import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { questionSchema } from "@/lib/validation/course";
import { addQuestion } from "@/server/services/admin.content.service";
import {
  assertQuizOwner,
  assertTestOwner,
  requireStaff,
  requireUser,
} from "@/server/guards";
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
    const body = await parseBody<{
      targetType?: "quiz" | "test";
      targetId?: string;
      question?: unknown;
    }>(req);
    if (!body.targetType || !body.targetId || !body.question) {
      throw badRequest("targetType, targetId and question are required");
    }
    const ref =
      body.targetType === "quiz"
        ? await assertQuizOwner(user, body.targetId, tctx)
        : await assertTestOwner(user, body.targetId, tctx);
    const question = questionSchema.parse(body.question);
    return ok(
      await addQuestion(
        { type: body.targetType, id: body.targetId },
        question,
        ref.tenantId,
      ),
      {
      status: 201,
    });
  });
}