import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { resendVerificationSchema } from "@/lib/validation/auth";
import { resendVerification } from "@/server/services/auth.verification.service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { getIp } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await enforceRateLimit(`resend:${getIp(req)}`);
    const input = resendVerificationSchema.parse(await parseBody(req));
    await resendVerification(input.email);
    return ok({ success: true });
  });
}
