/**
 * Best-effort email failure-path integration tests.
 *
 * Points the real SMTP sender at an unreachable host so the actual provider
 * connection fails, then asserts the fail-safe contracts:
 *  - a failed verification email never breaks registration (account commits);
 *  - a failed login OTP email is fail-closed (503 — the code is the only way
 *    in, so the user must not be left without it);
 *  - a failed receipt/notification never breaks enrollment.
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { TWO_STEP } from "@/generated/prisma/enums";
import { registerUser, loginUser } from "@/server/services/auth.service";
import { grantEnrollment } from "@/server/services/order.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { fixtureTenantId, grantMembership } from "../helpers/tenant";

process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "noreply@example.com";
process.env.SMTP_PASS = "not-a-real-password";

let seq = 0;

before(async () => {
  await provisionFreshTestDatabase();
});

test("registration commits even when the verification email provider fails", async () => {
  seq += 1;
  const email = `emailfail-${Date.now()}-${seq}@example.com`;
  const user = await registerUser({
    username: `emailfail-${Date.now()}-${seq}`,
    email,
    password: "password123",
  });
  assert.ok(user.id);
  assert.strictEqual(
    await prisma.user.count({ where: { email } }),
    1,
  );
});

test("login with EMAIL two-step fails closed (503) when the OTP email cannot be sent", async () => {
  seq += 1;
  const email = `emailfail2fa-${Date.now()}-${seq}@example.com`;
  const user = await registerUser({
    username: `emailfail2fa-${Date.now()}-${seq}`,
    email,
    password: "password123",
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { twoStep: TWO_STEP.EMAIL, twoStepSecret: null },
  });

  await assert.rejects(
    () => loginUser({ username: email, password: "password123" }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
      assert.strictEqual((err as ApiError).statusCode, 503);
      return true;
    },
  );
});

test("enrollment commits even when the receipt/notification side effects fail", async () => {
  seq += 1;
  const userId = `emailfail-user-${Date.now()}-${seq}`;
  await prisma.user.create({
    data: { id: userId, email: `${userId}@example.com`, username: userId, password: "x" },
  });
  await grantMembership(userId);
  const course = await prisma.course.create({
    data: {
      slug: `emailfail-course-${Date.now()}-${seq}`,
      title: `Email-fail course ${seq}`,
      price: 100,
      isPublished: true,
      tenantId: await fixtureTenantId(),
    },
  });

  const res = await grantEnrollment(userId, course.id, await fixtureTenantId());
  assert.deepStrictEqual(res, { alreadyEnrolled: false });
  assert.strictEqual(
    await prisma.enrollment.count({ where: { userId, courseId: course.id } }),
    1,
  );
});