/**
 * TenantContext integration tests.
 *
 * Verifies the canonical tenant-resolution mechanism against a real database:
 *   - valid active membership resolves
 *   - missing membership denies
 *   - inactive tenant (inactive membership) denies
 *   - user cannot resolve a tenant they do not belong to (by id or slug)
 *   - forged/unknown selection hint cannot bypass membership
 *   - unauthenticated resolution fails closed
 *   - SUPERADMIN platform role grants NO implicit tenant access
 *   - job context construction re-verifies and fails closed on revoked rows
 *
 * Run with: npx tsx --test tests/integration/tenant-context.test.ts
 */
import { before, test } from "node:test";
import assert from "node:assert";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import {
  resolveTenantContext,
  buildJobTenantContext,
  toTenantRef,
} from "@/server/tenant-context";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";

process.env.DATABASE_URL = getTestDatabaseUrl();

let seq = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

async function makeUser(role: UserRole) {
  return prisma.user.create({
    data: {
      email: `${uniq("u")}@t.local`,
      username: uniq("u"),
      password: "x",
      role,
    },
  });
}

async function makeTenant(active = true) {
  return prisma.tenant.create({
    data: { name: `T ${uniq("t")}`, slug: uniq("slug"), isActive: active },
  });
}

async function member(userId: string, tenantId: string, role: "STUDENT" | "INSTRUCTOR" = "STUDENT") {
  return prisma.tenantMembership.create({
    data: { userId, tenantId, role },
  });
}

async function denies(p: Promise<unknown>, code?: string) {
  try {
    await p;
    assert.fail("expected denial");
  } catch (e) {
    assert.ok(e instanceof ApiError, `expected ApiError, got ${String(e)}`);
    if (code) assert.equal(JSON.stringify((e as ApiError).errors ?? {}), JSON.stringify({ code }));
  }
}

let userA: Awaited<ReturnType<typeof makeUser>>;
let superadmin: Awaited<ReturnType<typeof makeUser>>;
let tenantA: Awaited<ReturnType<typeof makeTenant>>;

before(async () => {
  await provisionFreshTestDatabase();
  userA = await makeUser(UserRole.STUDENT);
  superadmin = await makeUser(UserRole.SUPERADMIN);
  tenantA = await makeTenant();
  await member(userA.id, tenantA.id);
});

test("valid active membership resolves the requested tenant", async () => {
  const ctx = await resolveTenantContext(userA, tenantA.slug);
  assert.equal(ctx.tenant.id, tenantA.id);
  assert.equal(ctx.role, "STUDENT");
  const byId = await resolveTenantContext(userA, tenantA.id);
  assert.equal(byId.tenant.slug, tenantA.slug);
});

test("default resolution works with exactly one active membership", async () => {
  const ctx = await resolveTenantContext(userA);
  assert.equal(ctx.tenant.id, tenantA.id);
});

test("missing membership denies", async () => {
  const outsider = await makeUser(UserRole.STUDENT);
  await denies(resolveTenantContext(outsider, tenantA.slug));
  await denies(resolveTenantContext(outsider));
});

test("inactive tenant (inactive membership) denies even for members", async () => {
  const dead = await makeTenant(false);
  const m = await member(userA.id, dead.id);
  await denies(resolveTenantContext(userA, dead.slug));
  // default resolution must also ignore inactive memberships
  const ctx = await resolveTenantContext(userA);
  assert.notEqual(ctx.tenant.id, dead.id);
  await prisma.tenantMembership.delete({ where: { id: m.id } });
});

test("user in Tenant A cannot resolve Tenant B by id or slug", async () => {
  const tenantB = await makeTenant();
  await denies(resolveTenantContext(userA, tenantB.id));
  await denies(resolveTenantContext(userA, tenantB.slug));
});

test("forged selection hint cannot bypass membership", async () => {
  await denies(resolveTenantContext(userA, "../../etc/passwd"));
  await denies(resolveTenantContext(userA, "' OR 1=1 --"));
  await denies(resolveTenantContext(userA, "tenant_default"));
});

test("multiple memberships without explicit selection requires selection", async () => {
  const tenantC = await makeTenant();
  await member(userA.id, tenantC.id);
  await denies(resolveTenantContext(userA), "TENANT_SELECTION_REQUIRED");
  const picked = await resolveTenantContext(userA, tenantC.slug);
  assert.equal(picked.tenant.id, tenantC.id);
});

test("unauthenticated request fails closed", async () => {
  await denies(resolveTenantContext(null));
  await denies(resolveTenantContext(null, tenantA.slug));
});

test("SUPERADMIN gets NO implicit tenant access", async () => {
  await denies(resolveTenantContext(superadmin));
  await denies(resolveTenantContext(superadmin, tenantA.slug));
});

test("job context re-verifies at execution time; revoked membership fails closed", async () => {
  const worker = await makeUser(UserRole.STUDENT);
  await member(worker.id, tenantA.id);
  const ctx = await buildJobTenantContext(worker.id, tenantA.id);
  assert.deepEqual(toTenantRef(ctx), { tenantId: tenantA.id });
  await prisma.tenantMembership.deleteMany({ where: { userId: worker.id } });
  await denies(buildJobTenantContext(worker.id, tenantA.id));
});
