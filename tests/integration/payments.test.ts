/**
 * Integration tests for payments (Stripe Checkout orchestration) and
 * price-gated enrollment.
 *
 * Runs against the throwaway elearning_test database. The Stripe-dependent
 * "paid checkout" flow is exercised without real Stripe by seeding PAID
 * orders directly and asserting the gating behavior on the services.
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import {
  enroll,
  isEnrolled,
} from "@/server/services/enrollment.service";
import {
  grantEnrollment,
  hasAccess,
  completeOrderFromStripe,
  confirmOrder,
} from "@/server/services/order.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { fixtureTenantId, grantMembership, ctxFor } from "../helpers/tenant";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;

async function seedUser(): Promise<string> {
  seq += 1;
  const id = `pay-user-${Date.now()}-${seq}`;
  await prisma.user.create({
    data: { id, email: `${id}@example.com`, username: id, password: "x" },
  });
  await grantMembership(id);
  return id;
}

async function seedCourse(opts: { price: number; published?: boolean }): Promise<string> {
  seq += 1;
  const course = await prisma.course.create({
    data: {
      slug: `pay-course-${Date.now()}-${seq}`,
      title: `Payments course ${seq}`,
      price: opts.price,
      isPublished: opts.published ?? true,
      tenantId: await fixtureTenantId(),
    },
  });
  return course.id;
}

before(async () => {
  await provisionFreshTestDatabase();
});

test("enroll() allows free courses immediately", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 0 });

  const res = await enroll(await ctxFor(userId), courseId);
  assert.deepStrictEqual(res, { alreadyEnrolled: false });
  assert.strictEqual(await isEnrolled(userId, courseId, await fixtureTenantId()), true);

  // Idempotent on repeat.
  const again = await enroll(await ctxFor(userId), courseId);
  assert.deepStrictEqual(again, { alreadyEnrolled: true });
});

test("enroll() rejects unpublished courses", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 0, published: false });
  await assert.rejects(async () => enroll(await ctxFor(userId), courseId), /Course not found/);
});

test("enroll() blocks paid courses without a PAID order", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 50000 });

  await assert.rejects(
    async () => enroll(await ctxFor(userId), courseId),
    /requires payment/,
  );
  assert.strictEqual(await isEnrolled(userId, courseId, await fixtureTenantId()), false);
});

test("enroll() allows paid courses once a PAID order exists", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 50000 });

  await prisma.order.create({
    data: {
      userId,
      courseId,
      amountPaid: 50000,
      status: "PAID",
      completedAt: new Date(),
    },
  });

  const res = await enroll(await ctxFor(userId), courseId);
  assert.deepStrictEqual(res, { alreadyEnrolled: false });
  assert.strictEqual(await isEnrolled(userId, courseId, await fixtureTenantId()), true);
});

test("hasAccess() reflects enrollment or PAID order", async () => {
  const userId = await seedUser();
  const freeCourseId = await seedCourse({ price: 0 });
  const paidCourseId = await seedCourse({ price: 50000 });

  assert.strictEqual(await hasAccess(userId, freeCourseId, await fixtureTenantId()), false);
  assert.strictEqual(await hasAccess(userId, paidCourseId, await fixtureTenantId()), false);

  await grantEnrollment(userId, freeCourseId, await fixtureTenantId());
  assert.strictEqual(await hasAccess(userId, freeCourseId, await fixtureTenantId()), true);

  await prisma.order.create({
    data: { userId, courseId: paidCourseId, amountPaid: 50000, status: "PAID" },
  });
  assert.strictEqual(await hasAccess(userId, paidCourseId, await fixtureTenantId()), true);
});

test("grantEnrollment() is idempotent and increments studentCount once", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 0 });

  const first = await grantEnrollment(userId, courseId, await fixtureTenantId());
  assert.deepStrictEqual(first, { alreadyEnrolled: false });
  const second = await grantEnrollment(userId, courseId, await fixtureTenantId());
  assert.deepStrictEqual(second, { alreadyEnrolled: true });

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { studentCount: true },
  });
  assert.strictEqual(course.studentCount, 1);
});

test("completeOrderFromStripe() marks the order PAID and enrolls; replay is a no-op", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 50000 });

  const sessionId = `cs_test_${Date.now()}-${seq}`;
  await prisma.order.create({
    data: {
      userId,
      courseId,
      amountPaid: 50000,
      status: "PENDING",
      stripeSessionId: sessionId,
    },
  });

  const first = await completeOrderFromStripe({
    id: sessionId,
    payment_intent: "pi_test_1",
  });
  assert.deepStrictEqual(first, { alreadyProcessed: false });

  const order = await prisma.order.findFirstOrThrow({ where: { stripeSessionId: sessionId } });
  assert.strictEqual(order.status, "PAID");
  assert.strictEqual(order.stripePaymentIntentId, "pi_test_1");
  assert.ok(order.completedAt instanceof Date);
  assert.strictEqual(await isEnrolled(userId, courseId, await fixtureTenantId()), true);

  // Webhook replays must not create duplicates.
  const replay = await completeOrderFromStripe({
    id: sessionId,
    payment_intent: "pi_test_1",
  });
  assert.deepStrictEqual(replay, { alreadyProcessed: true });
  assert.strictEqual(await prisma.enrollment.count({ where: { userId, courseId } }), 1);
  assert.strictEqual(
    await prisma.order.count({ where: { stripeSessionId: sessionId } }),
    1,
  );
});

test("confirmOrder() grants enrollment for free courses", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 0 });

  const res = await confirmOrder(await ctxFor(userId), courseId);
  assert.deepStrictEqual(res, { confirmed: true, enrolled: true, paid: true });
  assert.strictEqual(await isEnrolled(userId, courseId, await fixtureTenantId()), true);
});

test("confirmOrder() reports paid when a PENDING order is already PAID", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 50000 });

  await prisma.order.create({
    data: {
      userId,
      courseId,
      amountPaid: 50000,
      status: "PAID",
      stripeSessionId: `cs_paid_${Date.now()}-${seq}`,
      completedAt: new Date(),
    },
  });

  const res = await confirmOrder(await ctxFor(userId), courseId);
  assert.deepStrictEqual(res, { confirmed: true, enrolled: true, paid: true });
  assert.strictEqual(await isEnrolled(userId, courseId, await fixtureTenantId()), true);
});

test("confirmOrder() fails closed when no pending purchase exists", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse({ price: 50000 });

  await assert.rejects(
    async () => confirmOrder(await ctxFor(userId), courseId),
    /No pending purchase found/,
  );
});