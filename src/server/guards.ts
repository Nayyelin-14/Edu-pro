import type { User } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth";
import { ApiError, forbidden, unauthorized } from "@/lib/errors";

export type { User };

/** Returns the current user or throws 401. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw unauthorized("Please sign in");
  return user;
}

/** Returns the current user or null (no throw). */
export function optionalUser(): Promise<User | null> {
  return getSessionUser();
}

export async function requireVerified(user: User): Promise<User> {
  if (!user.emailVerifiedAt) {
    throw new ApiError(
      403,
      "Please verify your email to continue",
      { code: "EMAIL_NOT_VERIFIED" },
    );
  }
  return user;
}

/** Requires any staff role (ADMIN or SUPERADMIN). */
export async function requireStaff(user: User): Promise<User> {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
    throw forbidden("Admin access required");
  }
  return user;
}

/** Requires SUPERADMIN specifically. */
export async function requireSuperAdmin(user: User): Promise<User> {
  if (user.role !== UserRole.SUPERADMIN) {
    throw forbidden("Superadmin access required");
  }
  return user;
}

export function isStaff(user: User): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
}

export function isAdminOrHigher(user: User): boolean {
  return isStaff(user);
}
