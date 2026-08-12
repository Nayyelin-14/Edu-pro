import { NextRequest } from "next/server";
import { getIp, getUserAgent, ok, parseBody, run } from "@/lib/api";
import { setAuthCookies } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";
import { loginUser } from "@/server/services/auth.service";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await enforceRateLimit(`login:${getIp(req)}`);
    const input = loginSchema.parse(await parseBody(req));
    const result = await loginUser(input, {
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });
    if (result.needsTwoFactor) {
      return ok({
        needsTwoFactor: true,
        method: result.method,
        mfaToken: result.mfaToken,
      });
    }
    const res = ok({ user: result.user });
    return setAuthCookies(res, result.accessToken, result.refreshToken, input.remember);
  });
}
