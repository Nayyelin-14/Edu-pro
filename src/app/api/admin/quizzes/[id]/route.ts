import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateQuizSchema } from "@/lib/validation/course";
import { updateQuiz, deleteQuiz } from "@/server/services/admin.content.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    const input = updateQuizSchema.parse(await parseBody(req));
    return ok(await updateQuiz(id, input));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    await deleteQuiz(id);
    return ok({ success: true });
  });
}
