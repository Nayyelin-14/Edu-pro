/**
 * Tests for the authentication gate in src/proxy.ts (Next.js middleware).
 *
 * Middleware runs at the edge on every navigation and must:
 *  - block signed-out visitors (no access cookie) from protected user/admin
 *    routes by redirecting to /login, and
 *  - allow stale-but-maybe-refreshable sessions through (an expired access JWT
 *    backed by a still-valid refresh token) so the client can transparently
 *    refresh — instead of forcing a re-login.
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/jwt";
import { proxy } from "@/proxy";

const SECRET = "test-access-secret-123";
const REFRESH_COOKIE = "refresh_token";

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = SECRET;
});

function req(url: string, cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;
  return new NextRequest(`http://localhost:3000${url}`, { headers });
}

function location(res: Response): string | null {
  return res.headers.get("location");
}

function pathnameOf(loc: string | null): string {
  if (!loc) return "";
  try {
    return new URL(loc).pathname + new URL(loc).search;
  } catch {
    return loc;
  }
}

test("signed-out user is redirected to /login on a protected user route", async () => {
  const res = await proxy(req("/cmsqUser123/profile"));
  assert.equal(res.status, 307);
  const p = pathnameOf(location(res));
  assert.equal(p, "/login?next=%2FcmsqUser123%2Fprofile");
});

test("signed-out user is redirected to /login on a protected staff route", async () => {
  const res = await proxy(req("/staff/dashboard"));
  assert.equal(res.status, 307);
  const p = pathnameOf(location(res));
  assert.ok(p.startsWith("/login"), `expected /login, got ${p}`);
});

test("auth page with no session is not redirected (lets the user log in)", async () => {
  const res = await proxy(req("/login"));
  assert.equal(res.status, 200);
});

test("valid access session passes through (no redirect)", async () => {
  const token = await signAccessToken(
    { userId: "userA", role: "STUDENT" },
    "15m",
  );
  const res = await proxy(
    req("/userA/profile", `${REFRESH_COOKIE}=rt; access_token=${token}`),
  );
  assert.equal(res.status, 200);
});

test("expired access JWT (refreshable) is allowed through rather than bounced", async () => {
  // An expired JWT fails verification, but the cookie still exists: the
  // session may be refreshable, so middleware must NOT redirect to login.
  const token = await signAccessToken({ userId: "userA", role: "STUDENT" }, "-1s");
  const res = await proxy(
    req("/userA/profile", `${REFRESH_COOKIE}=rt; access_token=${token}`),
  );
  assert.equal(res.status, 200, "stale session should not be hard-redirected");
});

test("login page with a valid session is redirected away to /", async () => {
  const token = await signAccessToken({ userId: "userA", role: "STUDENT" }, "15m");
  const res = await proxy(req("/login", `access_token=${token}`));
  assert.equal(res.status, 307);
  assert.equal(pathnameOf(location(res)), "/");
});
