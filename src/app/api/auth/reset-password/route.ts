import { NextRequest } from "next/server";
import { getIp, ok, parseBody, run } from "@/lib/api";
import { enforceRateLimit } from "@/lib/ratelimit";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/server/services/auth.verification.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await enforceRateLimit(`reset-password:${getIp(req)}`);
    const input = resetPasswordSchema.parse(await parseBody(req));
    await resetPassword(input.token, input.password);
    return ok({ success: true });
  });
}
