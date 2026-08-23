/**
 * Phase F tests: SUPERADMIN platform-mode vs tenant-mode behavior, verified
 * against real services (not just the authorization helpers), so no hidden
 * User.role bypass can hide behind an active membership.
 *
 * Run with: npx tsx --test tests/integration/superadmin-modes.test.ts
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { UserRole } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import {
  hasTenantCapability,
  requirePlatformMode,
  requireTenantCapability,
} from "@/server/authorization";
import { resolveTenantContext } from "@/server/tenant-context";
import { assertCourseOwner } from "@/server/guards";
import { updateCourse } from "@/server/services/admin.course.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
let tenantId: string;
let saStudent: User; // SUPERADMIN (no membership needed for platform control)
let saInstructor: User; // SUPERADMIN with INSTRUCTOR membership
let saAdmin: User;
let plainInstructor: User;
let courseOwnedByPlainInstructor: string;
let courseOwnedBySaInstructor: string;

function expectStatus(status: number) {
  return (err: unknown): boolean => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    assert.strictEqual((err as ApiError).statusCode, status);
    return true;
  };
}

async function seedSuperadmin(): Promise<User> {
  seq += 1;
  const id = `sa-mode-${Date.now()}-${seq}`;
  return prisma.user.create({
    data: { id, username: id, email: `${id}@example.com`, password: "x", role: UserRole.SUPERADMIN, emailVerifiedAt: new Date() },
  });
}

async function membership(userId: string, role: "STUDENT" | "INSTRUCTOR") {
  await prisma.tenantMembership.create({ data: { userId, tenantId, role } });
}

async function ctxFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const m = await prisma.tenantMembership.findUniqueOrThrow({
    where: { userId_tenantId: { userId, tenantId } },
    include: { tenant: true },
  });
  return { user, tenant: m.tenant, membership: m, role: m.role };
}

before(async () => {
  await provisionFreshTestDatabase();
  const stamp = Date.now();
  tenantId = (
    await prisma.tenant.create({ data: { name: "SA Mode", slug: `sa-mode-${stamp}` } })
  ).id;

  saStudent = await seedSuperadmin();
  saInstructor = await seedSuperadmin();
  saAdmin = await seedSuperadmin();
  void saAdmin;
  plainInstructor = await prisma.user.create({
    data: { id: `pi-${stamp}`, username: `pi-${stamp}`, email: `pi-${stamp}@example.com`, password: "x", role: UserRole.INSTRUCTOR, emailVerifiedAt: new Date() },
  });

  await membership(saStudent.id, "STUDENT");
  await membership(saInstructor.id, "INSTRUCTOR");
  // saAdmin intentionally holds NO membership: platform authority suffices.

  courseOwnedByPlainInstructor = (
    await prisma.course.create({
      data: { slug: `sa-pi-${stamp}`, title: "PI course", price: 0, instructorId: plainInstructor.id, tenantId },
    })
  ).id;
  courseOwnedBySaInstructor = (
    await prisma.course.create({
      data: { slug: `sa-sa-${stamp}`, title: "SA course", price: 0, instructorId: saInstructor.id, tenantId },
    })
  ).id;
});

test("PLATFORM MODE is explicit and SUPERADMIN-only", async () => {
  await assert.rejects(async () => requirePlatformMode(plainInstructor), expectStatus(403));
  await requirePlatformMode(saStudent);
});

test("SUPERADMIN is the platform operator: manages ANY course without membership or ownership", async () => {
  // No tenant context required — platform mode.
  await assertCourseOwner(saStudent, courseOwnedByPlainInstructor);
  await assertCourseOwner(saAdmin, courseOwnedBySaInstructor);
  const updated = await updateCourse(courseOwnedByPlainInstructor, { title: "SA-controlled" }, tenantId);
  assert.strictEqual(updated.title, "SA-controlled");
});

test("SUPERADMIN + INSTRUCTOR membership: also authors own courses in tenant mode", async () => {
  const ctx = await ctxFor(saInstructor.id);
  requireTenantCapability(ctx, "author");
  await assertCourseOwner(saInstructor, courseOwnedBySaInstructor, ctx);
  const updated = await updateCourse(courseOwnedBySaInstructor, { title: "SA-authored" }, tenantId);
  assert.strictEqual(updated.title, "SA-authored");
});

test("SUPERADMIN without membership: tenant resolution fails closed", async () => {
  const loner = await seedSuperadmin();
  await assert.rejects(
    async () => resolveTenantContext(loner, null),
    expectStatus(403),
  );
});
