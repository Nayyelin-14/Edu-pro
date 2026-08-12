import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/server/services/auth.verification.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const input = resetPasswordSchema.parse(await parseBody(req));
    await resetPassword(input.token, input.password);
    return ok({ success: true });
  });
}
