import type { TenantRole, User } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { forbidden } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";

/**
 * Authorization model (Phase C, revised post-Phase-O).
 *
 * Two independent axes — never merged, never inferred from each other:
 *
 *   User.role              PLATFORM identity. STUDENT | INSTRUCTOR |
 *                          SUPERADMIN. SUPERADMIN is the platform operator:
 *                          whole-tenant administration (cross-tenant listings,
 *                          report resolution, certificate decisions, course
 *                          moderation) belongs to SUPERADMIN alone.
 *
 *   TenantMembership.role  TENANT authority. STUDENT → read,
 *                          INSTRUCTOR → author (create/manage their OWN
 *                          courses). Determined ONLY from the active
 *                          TenantContext (Phase B). There is no tenant-ADMIN
 *                          role.
 *
 * Modes:
 *   TENANT MODE    Instructors operate inside the active tenant on courses
 *                  they own; students read.
 *
 *   PLATFORM MODE  Explicit, SUPERADMIN-only, opted into per operation via
 *                  requirePlatformMode() / requireSuperAdmin() — whole-tenant
 *                  administration lives here and only here.
 *
 * Conflict rules:
 *   - Platform INSTRUCTOR + tenant STUDENT membership  → tenant authoring DENIED.
 *   - Platform STUDENT  + tenant INSTRUCTOR membership → tenant authoring ALLOWED
 *     (platform staff-console surface remains gated separately by requireStaff).
 *   - Membership is re-verified from the trusted context on every check;
 *     client-supplied roles/tenantIds are structurally unreachable here.
 */

export type TenantCapability = "read" | "author";

const ROLE_CAPABILITY: Record<TenantRole, TenantCapability> = {
  STUDENT: "read",
  INSTRUCTOR: "author",
};

const CAPABILITY_ORDER: Record<TenantCapability, number> = {
  read: 0,
  author: 1,
};

export function hasTenantCapability(
  ctx: TenantContext,
  required: TenantCapability,
): boolean {
  const held = ROLE_CAPABILITY[ctx.role];
  return held !== undefined && CAPABILITY_ORDER[held] >= CAPABILITY_ORDER[required];
}

/** Throws 403 when the active membership lacks the required capability. */
export function requireTenantCapability(
  ctx: TenantContext,
  required: TenantCapability,
): TenantContext {
  if (!hasTenantCapability(ctx, required)) {
    throw forbidden(`Requires ${required} access in this tenant`);
  }
  return ctx;
}

/**
 * PLATFORM MODE gate. Explicit SUPERADMIN-only opt-in for platform-scoped
 * operations. This is the ONLY sanctioned way to bypass tenant scoping, and
 * it never runs implicitly: call sites must choose it.
 */
export function requirePlatformMode(user: User): User {
  if (user.role !== UserRole.SUPERADMIN) {
    throw forbidden("Platform administrator access required");
  }
  return user;
}

export function isPlatformAdmin(user: User): boolean {
  return user.role === UserRole.SUPERADMIN;
}
