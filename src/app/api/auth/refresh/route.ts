import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getIp, getUserAgent, ok, run } from "@/lib/api";
import { REFRESH_COOKIE, setAuthCookies } from "@/lib/auth";
import { refreshTokens } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? "";
    // Preserve the original "Remember me" choice: when it was off, the rotated
    // refresh token stays a browser-session cookie instead of 7-day persistent.
    let remember = true;
    try {
      const body = (await req.json()) as { remember?: unknown };
      remember = body.remember !== false;
    } catch {
      // No/invalid body — default to persistent, matching the login default.
    }
    const result = await refreshTokens(refreshToken, {
      ip: getIp(req),
      userAgent: getUserAgent(req),
    });
    const res = ok({ user: result.user });
    return setAuthCookies(res, result.accessToken, result.refreshToken, remember);
  });
}
