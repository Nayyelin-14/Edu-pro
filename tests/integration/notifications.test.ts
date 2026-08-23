/**
 * Integration tests for the certificate verification API and in-app
 * notifications, plus the exam-runner test-status fix.
 *
 * Run with: npm run test:integration
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import { checkCertificate } from "@/server/services/certificate.service";
import {
  notify,
  listNotifications,
  markAllNotificationsRead,
} from "@/server/services/notification.service";
import { getTestStatus } from "@/server/services/test.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { fixtureTenantId, grantMembership, ctxFor } from "../helpers/tenant";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;

async function seedUser(): Promise<string> {
  seq += 1;
  const id = `nt-user-${Date.now()}-${seq}`;
  await prisma.user.create({
    data: { id, email: `${id}@example.com`, username: id, password: "x" },
  });
  await grantMembership(id);
  return id;
}

async function seedCourse(): Promise<string> {
  seq += 1;
  const course = await prisma.course.create({
    data: {
      slug: `nt-course-${Date.now()}-${seq}`,
      title: `Notifications course ${seq}`,
      price: 0,
      isPublished: true,
      tenantId: await fixtureTenantId(),
    },
  });
  return course.id;
}

before(async () => {
  await provisionFreshTestDatabase();
});

test("getTestStatus() returns timeLimitMinutes for the stat card", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse();
  const test = await prisma.test.create({
    data: {
      courseId,
      tenantId: await fixtureTenantId(),
      title: "Final test",
      timeLimitMinutes: 45,
      passingScore: 70,
      attemptLimit: 2,
    },
  });

  const status = await getTestStatus(await ctxFor(userId), test.id);
  assert.strictEqual(status.test.timeLimitMinutes, 45);
  assert.strictEqual(status.test.passingScore, 70);
  assert.strictEqual(status.attemptsUsed, 0);
  assert.strictEqual(status.lastResult, null);
});

test("checkCertificate() verifies a valid number and rejects unknown numbers", async () => {
  const userId = await seedUser();
  const courseId = await seedCourse();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });

  const certificate = await prisma.certificate.create({
    data: {
      userId,
      courseId,
      tenantId: await fixtureTenantId(),
      certificateNumber: "DT-TEST-123456",
      pdfUrl: "https://example.com/cert.pdf",
    },
  });

  const valid = await checkCertificate(certificate.certificateNumber);
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.courseTitle, course.title);
  assert.strictEqual(valid.number, "DT-TEST-123456");

  const unknown = await checkCertificate("DT-NOPE-000000");
  assert.deepStrictEqual(unknown, { valid: false });
});

test("notifications: list + unread count + mark all read", async () => {
  const userId = await seedUser();

  await notify({ userId, type: "SYSTEM", title: "First", body: "Hi" });
  await notify({ userId, type: "COURSE_APPROVED", title: "Second" });

  const first = await listNotifications(userId);
  assert.strictEqual(first.items.length, 2);
  assert.strictEqual(first.unread, 2);
  assert.strictEqual(first.items[0]!.title, "Second");

  await markAllNotificationsRead(userId);

  const second = await listNotifications(userId);
  assert.strictEqual(second.unread, 0);
  assert.ok(second.items.every((n) => n.read));
});

test("notifications are scoped per user", async () => {
  const userA = await seedUser();
  const userB = await seedUser();

  await notify({ userId: userA, type: "SYSTEM", title: "For A" });

  const [a, b] = await Promise.all([
    listNotifications(userA),
    listNotifications(userB),
  ]);
  assert.strictEqual(a.items.length, 1);
  assert.strictEqual(b.items.length, 0);
});