import { cache } from "react";
import type { Tenant, TenantMembership, TenantRole, User } from "@/generated/prisma/client";
import { getSessionUser } from "@/lib/auth";
import { ApiError, forbidden, unauthorized } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * Canonical tenant-resolution mechanism.
 *
 * This module is the ONLY place where the active tenant for an operation may
 * be resolved. Every tenant-aware service/route/job must derive its tenant
 * identity from a TenantContext produced here.
 *
 * Trust rules (non-negotiable):
 *   - The authenticated user comes ONLY from verified authentication.
 *   - A client-supplied tenant identifier (header, body, query, route param)
 *     is ever only a SELECTION HINT. It never authorizes anything by itself.
 *   - Authorization requires an ACTIVE TenantMembership row for the
 *     authenticated user on the resolved tenant.
 *   - All denial paths fail closed with identical semantics; existence of a
 *     tenant is never leaked to non-members.
 *
 * "Inactive membership" maps to the approved schema: a membership whose
 * tenant has isActive=false, or a removed membership row. There is no
 * separate membership-status column by design.
 *
 * SUPERADMIN carries NO implicit tenant access here. Platform-vs-tenant mode
 * policy is defined in Phase C; until then this module denies any user
 * without an explicit active membership.
 */

export interface TenantContext {
  /** The authenticated principal this context was resolved for. */
  user: User;
  tenant: Tenant;
  membership: TenantMembership;
  role: TenantRole;
}

/** Header clients may use to REQUEST a tenant. Verification happens server-side. */
export const TENANT_HINT_HEADER = "x-tenant-slug";

export class TenantSelectionRequiredError extends ApiError {
  constructor() {
    super(
      400,
      "Multiple tenants are available for your account — select one to continue",
      { code: "TENANT_SELECTION_REQUIRED" },
    );
  }
}

function denied(): ApiError {
  // Identical response whether the tenant is unknown, inactive, or the user
  // simply has no membership — prevents tenant enumeration.
  return forbidden("Access denied");
}

async function loadMemberships(userId: string) {
  return prisma.tenantMembership.findMany({
    where: { userId, tenant: { isActive: true } },
    include: { tenant: true },
  });
}

/**
 * Core resolver. `user` MUST come from trusted authentication (or be null,
 * which always denies). `requestedTenant` is an OPTIONAL client hint
 * (tenant id or slug) — treated strictly as a selection request.
 */
export async function resolveTenantContext(
  user: User | null,
  requestedTenant?: string | null,
): Promise<TenantContext> {
  if (!user) throw unauthorized("Please sign in");

  const memberships = await loadMemberships(user.id);

  if (requestedTenant !== undefined && requestedTenant !== null && requestedTenant !== "") {
    const match = memberships.find(
      (m) => m.tenant.slug === requestedTenant || m.tenant.id === requestedTenant,
    );
    if (!match) throw denied();
    return { user, tenant: match.tenant, membership: match, role: match.role };
  }

  if (memberships.length === 0) throw denied();
  if (memberships.length > 1) throw new TenantSelectionRequiredError();
  const only = memberships[0]!;
  return { user, tenant: only.tenant, membership: only, role: only.role };
}

/**
 * Request-scoped entry point for HTTP handlers. Reads the authenticated user
 * from the session and optionally a selection hint from the canonical header.
 * Route params, query strings, and request bodies are NEVER consulted here.
 */
export const getTenantContext = cache(
  async (hint?: string | null): Promise<TenantContext> => {
    const user = await getSessionUser();
    return resolveTenantContext(user, hint);
  },
);

/** Convenience overload matching the guards.ts calling style. */
export async function requireTenantContext(
  opts?: { requested?: string | null },
): Promise<TenantContext> {
  return getTenantContext(opts?.requested);
}

/**
 * Point-check for services operating on an already-known tenantId (e.g. a
 * resource fetched with its tenantId). Verifies the user holds an ACTIVE
 * membership on THAT tenant. Use this to prevent cross-tenant IDOR: fetch
 * rows scoped by tenantId derived from THIS context, or verify resource
 * tenantId against a context produced here.
 */
export async function assertTenantMember(
  user: User | null,
  tenantId: string,
): Promise<TenantContext> {
  if (!user) throw unauthorized("Please sign in");
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: user.id, tenantId, tenant: { isActive: true } },
    include: { tenant: true },
  });
  if (!membership) throw denied();
  return { user, tenant: membership.tenant, membership, role: membership.role };
}

/**
 * Non-HTTP construction point for background jobs / workers / queues.
 * Jobs must carry (userId, tenantId) as TRUSTED payload fields written by the
 * enqueuing request AFTER server-side resolution — never raw client input.
 * Re-verifies membership at execution time so revoked memberships fail closed
 * even mid-flight.
 */
export async function buildJobTenantContext(
  userId: string,
  tenantId: string,
): Promise<TenantContext> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBanned) throw denied();
  return assertTenantMember(user, tenantId);
}

/** Narrow shape services may persist into job payloads after resolution. */
export interface TenantRef {
  tenantId: string;
}

export function toTenantRef(ctx: TenantContext): TenantRef {
  return { tenantId: ctx.tenant.id };
}
