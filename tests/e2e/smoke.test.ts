/**
 * End-to-end smoke test against a real `next dev` server.
 *
 * Spawns a dev server on port 3100 pointed at the throwaway elearning_test
 * database and drives the full HTTP surface with a manual cookie jar:
 *   register -> duplicate 409 -> login -> refresh -> me
 *   verify email -> enroll free course -> comment
 *   enable EMAIL 2FA -> logout -> login (2FA) -> verify OTP
 *   logout -> refresh with revoked token -> 401
 *   staff: create course/lesson with malicious HTML -> sanitized in DB
 *   uploads: SVG rejected by magic-byte validation (400)
 *
 * Emails are forced to the dev log (no real SMTP/Resend in the child env).
 * Run with: npm run test:integration
 */
import { after, before, test } from "node:test";
import assert from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { OtpPurpose } from "@/generated/prisma/enums";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { prisma as p2 } from "@/lib/prisma";
/** The E2E flow uses the REAL default tenant — registration provisions
 * memberships there (DEFAULT_TENANT_SLUG || "default"). */
async function fixtureTenantId(): Promise<string> {
  const t = await p2.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Tenant", slug: "default" },
  });
  return t.id;
}

process.env.DATABASE_URL = getTestDatabaseUrl();

const BASE = "http://127.0.0.1:3100";
const PORT = 3100;
const INVITE_TOKEN = process.env.ADMIN_INVITE_TOKEN || "change-me-admin-invite-token";

let server: ChildProcess | null = null;

const jar = new Map<string, string>();

function cookieHeader(path: string): string {
  const names: string[] = [];
  if (path.startsWith("/api/auth")) names.push("refresh_token");
  names.push("access_token");
  const parts = names.filter((n) => jar.has(n)).map((n) => `${n}=${jar.get(n)}`);
  return parts.join("; ");
}

function storeCookies(res: Response): void {
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(";")[0];
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function api(
  path: string,
  opts: { method?: string; json?: unknown; body?: BodyInit } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(opts.json !== undefined ? { "content-type": "application/json" } : {}),
  };
  const cookie = cookieHeader(path);
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });
  storeCookies(res);
  return res;
}

async function insertOtp(userId: string, purpose: string, code: string): Promise<void> {
  await prisma.otpCode.create({
    data: {
      userId,
      purpose: purpose as OtpPurpose,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(10_000) });
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("Dev server did not become ready in time");
}

before(async () => {
  await provisionFreshTestDatabase();
  const bin = join(process.cwd(), "node_modules", ".bin", "next");
  server = spawn(bin, ["dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      DATABASE_URL: getTestDatabaseUrl(),
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      RESEND_API_KEY: "",
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitForReady();

  // Seed a superadmin so the staff flows can be driven through the real API.
  await prisma.user.create({
    data: {
      id: "e2e-superadmin",
      username: "e2e-superadmin",
      email: "e2e-superadmin@example.com",
      password: await hashPassword("password123"),
      role: "SUPERADMIN",
      emailVerifiedAt: new Date(),
    },
  });
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
  }
});

test("health endpoints respond", async () => {
  const health = await fetch(`${BASE}/api/health`);
  assert.strictEqual(health.status, 200);
  const ready = await fetch(`${BASE}/api/health/ready`);
  assert.strictEqual(ready.status, 200);
});

test("register -> duplicate 409 -> login -> refresh -> me", async () => {
  const email = `e2e-user-${Date.now()}@example.com`;
  const username = `e2euser${Date.now()}`;

  const reg = await api("/api/auth/register", {
    method: "POST",
    json: { username, email, password: "password123" },
  });
  assert.strictEqual(reg.status, 201);
  assert.strictEqual(await prisma.user.count({ where: { email } }), 1);

  const dup = await api("/api/auth/register", {
    method: "POST",
    json: { username: `${username}x`, email, password: "password123" },
  });
  assert.strictEqual(dup.status, 409);

  const login = await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });
  assert.strictEqual(login.status, 200);
  assert.ok(jar.has("access_token"));
  assert.ok(jar.has("refresh_token"));

  const me1 = await api("/api/me");
  assert.strictEqual(me1.status, 200);
  const me1Body = (await me1.json()) as { data: { user: { email: string } } };
  assert.strictEqual(me1Body.data.user.email, email);

  const refresh = await api("/api/auth/refresh", { method: "POST", json: {} });
  assert.strictEqual(refresh.status, 200);

  const me2 = await api("/api/me");
  assert.strictEqual(me2.status, 200);
});

test("verify email via OTP then enroll in a free course and comment", async () => {
  const email = `e2e-verified-${Date.now()}@example.com`;
  const username = `e2ever${Date.now()}`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    json: { username, email, password: "password123" },
  });
  assert.strictEqual(reg.status, 201);
  const regBody = (await reg.json()) as { data: { user: { id: string } } };
  const userId = regBody.data.user.id;

  const login = await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });
  assert.strictEqual(login.status, 200);

  await insertOtp(userId, OtpPurpose.EMAIL_VERIFICATION, "123456");
  const verify = await api("/api/auth/verify-email", {
    method: "POST",
    json: { code: "123456" },
  });
  assert.strictEqual(verify.status, 200);
  assert.ok(
    (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
      .emailVerifiedAt,
  );

  const course = await prisma.course.create({
    data: {
      slug: `e2e-free-${Date.now()}`,
      title: "E2E free course",
      price: 0,
      isPublished: true,
      tenantId: await fixtureTenantId(),
    },
  });
  const courseModule = await prisma.module.create({
    data: { courseId: course.id, title: "M", position: 0, tenantId: await fixtureTenantId() },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: courseModule.id, title: "L", type: "READING", position: 0, tenantId: await fixtureTenantId() },
  });

  const enrollRes = await api(`/api/courses/${course.id}/enroll`, { method: "POST" });
  assert.strictEqual(enrollRes.status, 200);
  const enrollBody = (await enrollRes.json()) as { data: { alreadyEnrolled: boolean } };
  assert.strictEqual(enrollBody.data.alreadyEnrolled, false);

  const commentRes = await api("/api/comments", {
    method: "POST",
    json: { lessonId: lesson.id, content: "Looks great!" },
  });
  assert.strictEqual(commentRes.status, 201);
  assert.strictEqual(await prisma.comment.count({ where: { lessonId: lesson.id } }), 1);
});

test("EMAIL two-step enable -> logout -> login requires 2FA -> verify OTP", async () => {
  const email = `e2e-2fa-${Date.now()}@example.com`;
  const username = `e2e2fa${Date.now()}`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    json: { username, email, password: "password123" },
  });
  assert.strictEqual(reg.status, 201);
  const regBody = (await reg.json()) as { data: { user: { id: string } } };
  const userId = regBody.data.user.id;

  const login = await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });
  assert.strictEqual(login.status, 200);

  const init = await api("/api/auth/enable-2fa", {
    method: "POST",
    json: { method: "EMAIL" },
  });
  assert.strictEqual(init.status, 200);

  await insertOtp(userId, OtpPurpose.TWO_FACTOR, "654321");
  const confirm = await api("/api/auth/enable-2fa/confirm", {
    method: "POST",
    json: { method: "EMAIL", code: "654321" },
  });
  assert.strictEqual(confirm.status, 200);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.strictEqual(user.twoStep, "EMAIL");

  const logout = await api("/api/auth/logout", { method: "POST" });
  assert.strictEqual(logout.status, 200);

  const login2 = await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });
  assert.strictEqual(login2.status, 200);
  const login2Body = (await login2.json()) as {
    data: { needsTwoFactor: true; method: string; mfaToken: string };
  };
  assert.strictEqual(login2Body.data.needsTwoFactor, true);
  assert.strictEqual(login2Body.data.method, "EMAIL");

  await insertOtp(userId, OtpPurpose.LOGIN, "111222");
  const otp = await api("/api/auth/verify-otp", {
    method: "POST",
    json: { token: login2Body.data.mfaToken, code: "111222" },
  });
  assert.strictEqual(otp.status, 200);
  assert.ok(jar.has("access_token"));
  assert.ok(jar.has("refresh_token"));
});

test("logout revokes the refresh token (refresh after logout -> 401)", async () => {
  const email = `e2e-logout-${Date.now()}@example.com`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    json: { username: `e2elogout${Date.now()}`, email, password: "password123" },
  });
  assert.strictEqual(reg.status, 201);
  await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });

  const logout = await api("/api/auth/logout", { method: "POST" });
  assert.strictEqual(logout.status, 200);

  const refresh = await api("/api/auth/refresh", { method: "POST", json: {} });
  assert.strictEqual(refresh.status, 401);
});

test("staff course/lesson creation sanitizes stored HTML (XSS)", async () => {
  // Login as the seeded superadmin, then create an instructor via the API.
  const superLogin = await api("/api/auth/login", {
    method: "POST",
    json: { username: "e2e-superadmin", password: "password123" },
  });
  assert.strictEqual(superLogin.status, 200);

  const instrUsername = `e2einstr${Date.now()}`;
  const staffReg = await api("/api/staff/register", {
    method: "POST",
    json: {
      inviteToken: INVITE_TOKEN,
      username: instrUsername,
      email: `${instrUsername}@example.com`,
      password: "password123",
    },
  });
  assert.strictEqual(staffReg.status, 201);

  // Switch to the instructor account.
  await api("/api/auth/logout", { method: "POST" });
  const instrLogin = await api("/api/auth/login", {
    method: "POST",
    json: { username: instrUsername, password: "password123" },
  });
  assert.strictEqual(instrLogin.status, 200);

  const malicious = '<script>alert(1)</script><p onclick="alert(2)">hello</p>';
  const courseRes = await api("/api/staff/courses", {
    method: "POST",
    json: {
      title: "E2E sanitized course",
      slug: `e2e-sanitized-${Date.now()}`,
      description: malicious,
      price: 0,
    },
  });
  assert.strictEqual(courseRes.status, 201);
  const courseBody = (await courseRes.json()) as { data: { id: string } };

  const moduleRes = await api("/api/staff/modules", {
    method: "POST",
    json: { courseId: courseBody.data.id, title: "Intro" },
  });
  assert.strictEqual(moduleRes.status, 201);
  const moduleBody = (await moduleRes.json()) as { data: { id: string } };

  const lessonRes = await api("/api/staff/lessons", {
    method: "POST",
    json: {
      moduleId: moduleBody.data.id,
      title: "Lesson",
      article: '<img src="x" onerror="alert(1)">text',
    },
  });
  assert.strictEqual(lessonRes.status, 201);
  const lessonBody = (await lessonRes.json()) as { data: { id: string } };

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseBody.data.id },
  });
  assert.ok(course.description);
  assert.ok(!course.description.includes("<script"));
  assert.ok(!course.description.includes("onclick"));
  assert.ok(course.description.includes("hello"));

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonBody.data.id } });
  assert.ok(lesson.article);
  assert.ok(!lesson.article.includes("onerror"));
  assert.ok(lesson.article.includes("text"));
});

test("uploads reject script-capable files by magic bytes", async () => {
  const email = `e2e-upload-${Date.now()}@example.com`;
  await api("/api/auth/register", {
    method: "POST",
    json: { username: `e2eup${Date.now()}`, email, password: "password123" },
  });
  const login = await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });
  assert.strictEqual(login.status, 200);

  const form = new FormData();
  form.append("folder", "avatars");
  form.append(
    "file",
    new Blob(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'], {
      type: "image/svg+xml",
    }),
    "evil.svg",
  );
  const res = await api("/api/uploads", { method: "POST", body: form });
  assert.strictEqual(res.status, 400);
  const body = (await res.json()) as { message: string };
  assert.match(body.message, /not allowed/);
});