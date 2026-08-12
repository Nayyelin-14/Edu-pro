import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createAdminSchema } from "@/lib/validation/admin";
import { createAdmin } from "@/server/services/admin.user.service";
import { requireUser, requireSuperAdmin } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const superadmin = await requireSuperAdmin(await requireUser());
    const input = createAdminSchema.parse(await parseBody(req));
    await createAdmin(input);
    return ok({ success: true, createdBy: superadmin.id }, { status: 201 });
  });
}
