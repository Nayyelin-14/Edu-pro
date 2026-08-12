import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateTestSchema } from "@/lib/validation/course";
import { updateTest, deleteTest } from "@/server/services/admin.content.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    const input = updateTestSchema.parse(await parseBody(req));
    return ok(await updateTest(id, input));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    await deleteTest(id);
    return ok({ success: true });
  });
}
