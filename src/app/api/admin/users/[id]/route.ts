import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateUserSchema } from "@/lib/validation/admin";
import { updateUser, deleteUser } from "@/server/services/admin.user.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const admin = await requireStaff(await requireUser());
    const { id } = await params;
    const input = updateUserSchema.parse(await parseBody(req));
    return ok(await updateUser(admin, id, input));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const admin = await requireStaff(await requireUser());
    const { id } = await params;
    await deleteUser(admin, id);
    return ok({ success: true });
  });
}
