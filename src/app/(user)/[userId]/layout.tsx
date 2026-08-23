import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RequireAuth } from "@/components/auth/require-auth";

export const dynamic = "force-dynamic";

interface UserIdLayoutProps {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}

/**
 * Server-side ownership guard for the dynamic `[userId]` segment.
 *
 * The URL `[userId]` is untrusted. We read the authenticated user from the
 * session cookie (the only source of truth), and when the session is valid we
 * require the URL segment to match it:
 *   - /{someone-else}/profile  →  /{me}/profile
 *   - /logout/profile          →  /{me}/profile   (no /logout page exists, so
 *                                                 "logout" is just a bogus id)
 * Mismatches redirect to the canonical URL rather than 404, and never render the
 * page, so no protected content is ever served for another user.
 *
 * A null session here means the access JWT is expired/invalid but a session may
 * still be refreshable; in that case we render and let the client RequireAuth
 * attempt a refresh — RequireAuth also re-checks ownership once the session
 * resolves (covers the stale-then-refreshed window).
 */
export default async function UserIdLayout({
  children,
  params,
}: UserIdLayoutProps) {
  const { userId } = await params;
  const session = await getSessionUser();

  if (session && session.id !== userId) {
    redirect(`/${session.id}/dashboard`);
  }

  return (
    <RequireAuth userId={userId}>
      {children}
    </RequireAuth>
  );
}
