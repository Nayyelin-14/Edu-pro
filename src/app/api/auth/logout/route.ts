import { cookies } from "next/headers";
import { ok, run } from "@/lib/api";
import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth";
import { logout } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export async function POST() {
  return run(async () => {
    const cookieStore = await cookies();
    await logout(cookieStore.get(REFRESH_COOKIE)?.value ?? "");
    const res = ok({ success: true });
    return clearAuthCookies(res);
  });
}
