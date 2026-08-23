import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const encoder = new TextEncoder();
const STAFF = new Set(["INSTRUCTOR", "SUPERADMIN"]);

const USER_PREFIXES = ["/learning"];
const USER_SUFFIX_RE =
  /^\/[^/]+\/(profile|my-courses|saved|certificates|reports|roadmap)(\/|$)/;
const STAFF_PREFIXES = ["/staff"];
const AUTH_PAGES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

interface SessionCheck {
  valid: boolean;
  role: string | null;
  hasAccessCookie: boolean;
}

/**
 * The access JWT expires after 15 min, but the cookie that carries it outlives
 * the JWT (up to the refresh session lifetime). A present-but-unverifiable
 * cookie therefore means "this session may still be refreshable via the refresh
 * token" — NOT "fully logged out". Only the absence of the cookie is definitive,
 * because a logged-out browser has neither cookie.
 */
async function getSession(req: NextRequest): Promise<SessionCheck> {
  const token = req.cookies.get("access_token")?.value;
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!token) return { valid: false, role: null, hasAccessCookie: false };
  if (!secret) return { valid: false, role: null, hasAccessCookie: true };
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    if (!payload.sub) return { valid: false, role: null, hasAccessCookie: true };
    return {
      valid: true,
      role: String(payload.role ?? "STUDENT"),
      hasAccessCookie: true,
    };
  } catch {
    // Expired/invalid JWT. Let the request through: the client rotates the
    // session via /api/auth/refresh (which the refresh cookie reaches) and
    // retries. If refresh also fails, the client redirects to /login with the
    // original destination in `next`.
    return { valid: false, role: null, hasAccessCookie: true };
  }
}

function redirectTo(req: NextRequest, path: string, next?: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = path;
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSession(req);
  const isStaff = session.valid ? STAFF.has(session.role ?? "") : false;

  if (STAFF_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!session.hasAccessCookie) return redirectTo(req, "/login", pathname);
    if (session.valid && !isStaff) return redirectTo(req, "/");
  }

  if (
    USER_PREFIXES.some((p) => pathname.startsWith(p)) ||
    USER_SUFFIX_RE.test(pathname)
  ) {
    if (!session.hasAccessCookie) return redirectTo(req, "/login", pathname);
  }

  if (AUTH_PAGES.has(pathname)) {
    if (session.valid) return redirectTo(req, "/");
  }

  return NextResponse.next();
}

// Run the session proxy on all page routes (excluding API routes, which are
// guarded server-side, and static assets). Auth pages get the "already signed
// in" redirect; /staff and /learning plus user-area routes get the
// "not signed in" redirect to /login.
export const config = {
  matcher: [
    "/staff/:path*",
    "/learning/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpg|jpeg|svg|ico|webp|mp4|webm)$).*)",
  ],
};
