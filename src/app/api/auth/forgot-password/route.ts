import { NextRequest } from "next/server";
import { getIp, ok, parseBody, run } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { forgotPassword } from "@/server/services/auth.verification.service";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await enforceRateLimit(`forgot:${getIp(req)}`);
    const input = forgotPasswordSchema.parse(await parseBody(req));
    await forgotPassword(input.email);
    return ok({ success: true });
  });
}
