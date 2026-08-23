import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { updateUserSchema } from "@/lib/validation/admin";
import { updateUser, deleteUser } from "@/server/services/admin.user.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const superadmin = await requireSuperAdmin(await requireUser());
    const { id } = await params;
    const input = updateUserSchema.parse(await parseBody(req));
    return ok(await updateUser(superadmin, id, input));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const superadmin = await requireSuperAdmin(await requireUser());
    const { id } = await params;
    await deleteUser(superadmin, id);
    return ok({ success: true });
  });
}
