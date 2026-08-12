import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/server/services/auth.twoStep.service";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();
    const input = changePasswordSchema.parse(await parseBody(req));
    await changePassword(user, input.currentPassword, input.newPassword);
    return ok({ success: true });
  });
}
