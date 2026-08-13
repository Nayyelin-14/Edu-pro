"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeReturnTo } from "@/lib/urls";

interface RequireAuthProps {
  children: React.ReactNode;
  /**
   * The user-id segment from the route (e.g. `/{userId}/profile`), or undefined.
   * When present, mismatches against the authenticated session user are
   * redirected to the session user's canonical URL.
   */
  userId?: string;
}

/**
 * Client-side authentication + ownership guard for protected user pages.
 *
 * - If there is no authenticated session (and we've finished loading), redirect
 *   to /login preserving the destination, so signed-out visitors — including
 *   those whose session expired and cannot be refreshed — never see protected
 *   content.
 * - If the session resolves to a different user than the URL's [userId]
 *   segment, redirect to that user's canonical profile. This covers the
 *   "stale access token + valid refresh" window where the server-side layout
 *   couldn't assert ownership (the expired access JWT reads as null at SSR).
 *
 * This is defense-in-depth: the middleware and the server layout guard also
 * enforce authn/ownership at the edge and at SSR.
 */
export function RequireAuth({ children, userId }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(sanitizeReturnTo(pathname))}`);
      return;
    }
    if (userId && user.id !== userId) {
      router.replace(`/${user.id}/profile`);
    }
  }, [loading, user, userId, pathname, router]);

  if (loading) return <>{children}</>;
  return <>{children}</>;
}
