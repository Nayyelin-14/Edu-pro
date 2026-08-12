import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { deleteQuestion } from "@/server/services/admin.content.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    const body = await parseBody<{ targetType?: "quiz" | "test"; targetId?: string }>(req);
    if (!body.targetType || !body.targetId) {
      throw badRequest("targetType and targetId are required");
    }
    return ok(await deleteQuestion({ type: body.targetType, id: body.targetId }, id));
  });
}
