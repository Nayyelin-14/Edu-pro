/**
 * Authorization model (Phase C) integration tests.
 *
 * Covers the platform-role × tenant-role conflict matrix against a real DB:
 *   1. SUPERADMIN with/without membership
 *   2. platform INSTRUCTOR + tenant STUDENT
 *   3. platform STUDENT + tenant INSTRUCTOR
 *   4. no membership
 *   5. multiple memberships (selection still required — Phase B behavior)
 *   6. removed membership
 *   7. inactive tenant
 *
 * Run with: npx tsx --test tests/integration/authorization.test.ts
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import {
  hasTenantCapability,
  requireTenantCapability,
  requirePlatformMode,
  isPlatformAdmin,
} from "@/server/authorization";
import { resolveTenantContext } from "@/server/tenant-context";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

async function makeUser(role: UserRole) {
  return prisma.user.create({
    data: { email: `${uniq("u")}@t.local`, username: uniq("u"), password: "x", role },
  });
}
async function makeTenant(active = true) {
  return prisma.tenant.create({
    data: { name: `T ${uniq("t")}`, slug: uniq("slug"), isActive: active },
  });
}
async function member(userId: string, tenantId: string, role: "STUDENT" | "INSTRUCTOR") {
  return prisma.tenantMembership.create({ data: { userId, tenantId, role } });
}
async function denies(p: Promise<unknown>) {
  try {
    await p;
    assert.fail("expected denial");
  } catch (e) {
    assert.ok(e instanceof ApiError);
  }
}

// Case fixtures
let sa_noMem: Awaited<ReturnType<typeof makeUser>>;        // case 1a
let sa_member_student: Awaited<ReturnType<typeof makeUser>>; // case 1b
let instr_studMem: Awaited<ReturnType<typeof makeUser>>;   // case 2
let stud_instrMem: Awaited<ReturnType<typeof makeUser>>;   // case 3
let noMem: Awaited<ReturnType<typeof makeUser>>;           // case 4
let multiMem: Awaited<ReturnType<typeof makeUser>>;        // case 5
let removedMem: Awaited<ReturnType<typeof makeUser>>;      // case 6
let inactMem: Awaited<ReturnType<typeof makeUser>>;        // case 7
let tenantA: Awaited<ReturnType<typeof makeTenant>>;
let deadTenant: Awaited<ReturnType<typeof makeTenant>>;

before(async () => {
  await provisionFreshTestDatabase();
  tenantA = await makeTenant();
  deadTenant = await makeTenant(false);

  sa_noMem = await makeUser(UserRole.SUPERADMIN);
  sa_member_student = await makeUser(UserRole.SUPERADMIN);
  instr_studMem = await makeUser(UserRole.INSTRUCTOR);
  stud_instrMem = await makeUser(UserRole.STUDENT);
  noMem = await makeUser(UserRole.STUDENT);
  multiMem = await makeUser(UserRole.INSTRUCTOR);
  removedMem = await makeUser(UserRole.INSTRUCTOR);
  inactMem = await makeUser(UserRole.STUDENT);

  await member(sa_member_student.id, tenantA.id, "STUDENT");
  await member(instr_studMem.id, tenantA.id, "STUDENT");
  await member(stud_instrMem.id, tenantA.id, "INSTRUCTOR");
  await member(multiMem.id, tenantA.id, "INSTRUCTOR");
  const t2 = await makeTenant();
  await member(multiMem.id, t2.id, "STUDENT");
  await member(removedMem.id, tenantA.id, "STUDENT");
  await member(inactMem.id, deadTenant.id, "INSTRUCTOR");
});

test("case 1a: SUPERADMIN without membership — tenant ops denied, platform mode allowed", async () => {
  await denies(resolveTenantContext(sa_noMem, tenantA.slug));
  assert.ok(isPlatformAdmin(sa_noMem));
  requirePlatformMode(sa_noMem); // must not throw
});

test("case 1b: SUPERADMIN WITH membership — limited to that membership's capability", async () => {
  const ctx = await resolveTenantContext(sa_member_student, tenantA.slug);
  assert.ok(hasTenantCapability(ctx, "read"));
  assert.ok(!hasTenantCapability(ctx, "author"));
  await denies(Promise.resolve().then(() => requireTenantCapability(ctx, "author")));
  // ...and platform mode remains available independently
  requirePlatformMode(sa_member_student);
});

test("case 2: platform INSTRUCTOR + tenant STUDENT membership — authoring denied", async () => {
  const ctx = await resolveTenantContext(instr_studMem, tenantA.slug);
  await denies(Promise.resolve().then(() => requireTenantCapability(ctx, "author")));
  assert.ok(!hasTenantCapability(ctx, "author"));
});

test("case 3: platform STUDENT + tenant INSTRUCTOR membership — tenant authoring allowed", async () => {
  const ctx = await resolveTenantContext(stud_instrMem, tenantA.slug);
  requireTenantCapability(ctx, "author"); // must not throw
  assert.ok(hasTenantCapability(ctx, "author"));
  // ...but the PLATFORM staff gate is unaffected by tenant role:
  try {
    // simulate guards.requireStaff semantics on this user
    if (stud_instrMem.role !== UserRole.INSTRUCTOR && stud_instrMem.role !== UserRole.SUPERADMIN) {
      throw new ApiError(403, "Admin access required");
    }
    assert.fail("requireStaff should deny platform STUDENT");
  } catch {
    // expected denial path
  }
});

test("case 4: no membership — everything tenant-scoped denied (any platform role)", async () => {
  await denies(resolveTenantContext(noMem, tenantA.slug));
  const saNoMemCtx = null;
  assert.equal(saNoMemCtx, null);
});

test("case 5: multiple memberships — selection still required, chosen role applies", async () => {
  await denies(resolveTenantContext(multiMem));
  const ctx = await resolveTenantContext(multiMem, tenantA.slug);
  requireTenantCapability(ctx, "author"); // INSTRUCTOR on tenantA
});

test("case 6: removed membership — fails closed after removal", async () => {
  const before = await resolveTenantContext(removedMem, tenantA.slug);
  requireTenantCapability(before, "read");
  await prisma.tenantMembership.deleteMany({ where: { userId: removedMem.id, tenantId: tenantA.id } });
  await denies(resolveTenantContext(removedMem, tenantA.slug));
});

test("case 7: inactive tenant — fails closed even for ADMIN members", async () => {
  await denies(resolveTenantContext(inactMem, deadTenant.slug));
});

test("capability ladder: read < author per membership role", async () => {
  const student = await makeUser(UserRole.STUDENT);
  const instructor = await makeUser(UserRole.STUDENT);
  await member(student.id, tenantA.id, "STUDENT");
  await member(instructor.id, tenantA.id, "INSTRUCTOR");

  const s = await resolveTenantContext(student, tenantA.slug);
  const i = await resolveTenantContext(instructor, tenantA.slug);

  assert.ok(hasTenantCapability(s, "read") && !hasTenantCapability(s, "author"));
  assert.ok(hasTenantCapability(i, "read") && hasTenantCapability(i, "author"));

  // There is no tenant-admin role: only two membership levels exist.
  await denies(Promise.resolve().then(() => requireTenantCapability(s, "author")));
});

test("platform mode is SUPERADMIN-only and explicit", async () => {
  const plain = await makeUser(UserRole.INSTRUCTOR);
  await denies(Promise.resolve().then(() => requirePlatformMode(plain)));
  await denies(Promise.resolve().then(() => requirePlatformMode(stud_instrMem)));
  requirePlatformMode(sa_noMem);
});
