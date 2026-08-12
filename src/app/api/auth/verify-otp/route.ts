import { NextRequest } from "next/server";
import { getIp, getUserAgent, ok, parseBody, run } from "@/lib/api";
import { setAuthCookies } from "@/lib/auth";
import { verifyOtpSchema } from "@/lib/validation/auth";
import { completeLoginWithOtp } from "@/server/services/auth.service";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await enforceRateLimit(`otp:${getIp(req)}`);
    const input = verifyOtpSchema.parse(await parseBody(req));
    const result = await completeLoginWithOtp(input, {
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });
    const res = ok({ user: result.user });
    return setAuthCookies(res, result.accessToken, result.refreshToken, true);
  });
}
