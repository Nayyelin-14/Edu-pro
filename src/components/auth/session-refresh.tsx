"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { getRememberMe } from "@/lib/remember-me";
import type { PublicUser } from "@/types/user";

/**
 * Client-side session recovery for the staff area.
 *
 * The access JWT is short-lived while the refresh cookie outlives it, and the
 * refresh cookie is scoped to `/api/auth` so it never reaches page renders.
 * That means server-side guards see a "null" session once the access JWT has
 * expired, even though the session is still refreshable. Hard-redirecting to
 * /login there loops forever with the login page's auto-redirect (login sees
 * the refreshable session and bounces straight back).
 *
 * Instead, when the server guard can't resolve the session, render this screen:
 * it rotates the session on the client (where the refresh cookie IS available)
 * and then asks Next to re-render the current route's server components. Only
 * when the refresh definitively fails do we go to /login.
 */
export function SessionRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const toLogin = () =>
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);

    (async () => {
      try {
        await apiFetch<{ user: PublicUser }>("/api/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ remember: getRememberMe() }),
        });
        if (cancelled) return;
        router.refresh();
      } catch {
        if (!cancelled) toLogin();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Refreshing session…</p>
    </div>
  );
}