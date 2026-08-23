/**
 * Phase D test helpers: tenant fixtures.
 *
 * Fresh test databases contain no Tenant rows, and every tenant-owned row now
 * requires one. Services additionally expect a trusted TenantContext instead
 * of raw userIds. These helpers centralize that setup.
 */
import type { TenantContext } from "@/server/tenant-context";
import { prisma } from "@/lib/prisma";

let cachedTenantId: string | null = null;

/** Idempotently creates the fixture tenant and returns its id. */
export async function fixtureTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  const existing = await prisma.tenant.findUnique({ where: { slug: "fixture-default" } });
  if (existing) {
    cachedTenantId = existing.id;
    return cachedTenantId;
  }
  const created = await prisma.tenant.create({
    data: { name: "Fixture Tenant", slug: "fixture-default" },
  });
  cachedTenantId = created.id;
  return cachedTenantId;
}

/** Creates an active STUDENT membership for the user on the fixture tenant. */
export async function grantMembership(
  userId: string,
  role: "STUDENT" | "INSTRUCTOR" = "STUDENT",
): Promise<void> {
  const tenantId = await fixtureTenantId();
  await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { role },
    create: { userId, tenantId, role },
  });
}

/** Builds a trusted TenantContext for a user with a fixture membership. */
export async function ctxFor(userId: string): Promise<TenantContext> {
  const { prisma: p } = await import("@/lib/prisma");
  const user = await p.user.findUniqueOrThrow({ where: { id: userId } });
  const tenantId = await fixtureTenantId();
  const membership = await p.tenantMembership.findUniqueOrThrow({
    where: { userId_tenantId: { userId, tenantId } },
    include: { tenant: true },
  });
  return {
    user,
    tenant: membership.tenant,
    membership,
    role: membership.role,
  };
}
