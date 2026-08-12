import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const encoder = new TextEncoder();
const STAFF = new Set(["ADMIN", "SUPERADMIN"]);

const USER_PREFIXES = [
  "/learning",
  "/profile",
  "/saved",
  "/reports",
  "/my-courses",
  "/certificates",
];
const STAFF_PREFIXES = ["/admin"];
const AUTH_PAGES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

async function getSession(
  req: NextRequest,
): Promise<{ role: string } | null> {
  const token = req.cookies.get("access_token")?.value;
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    if (!payload.sub) return null;
    return { role: String(payload.role ?? "STUDENT") };
  } catch {
    return null;
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
  const isStaff = session ? STAFF.has(session.role) : false;

  if (STAFF_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!session) return redirectTo(req, "/login", pathname);
    if (!isStaff) return redirectTo(req, "/");
  }

  if (USER_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith("/certificates/verify")) {
      return NextResponse.next();
    }
    if (!session) return redirectTo(req, "/login", pathname);
  }

  if (AUTH_PAGES.has(pathname)) {
    if (session) return redirectTo(req, "/");
  }

  return NextResponse.next();
}
