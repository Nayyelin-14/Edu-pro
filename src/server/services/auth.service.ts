import type { User } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { OtpPurpose, TWO_STEP } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth";
import { REFRESH_TTL_MS, publicUser } from "@/lib/auth";
import { bestEffort } from "@/lib/async";
import { sha256, randomOpaqueToken, decryptSecret } from "@/lib/crypto";
import { sendLoginOtpEmail, sendVerificationEmail } from "@/lib/email";
import {
  badRequest,
  conflict,
  forbidden,
  internal,
  serviceUnavailable,
  unauthorized,
} from "@/lib/errors";
import { signAccessToken, signMfaToken, verifyMfaToken } from "@/lib/jwt";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { logError } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/totp";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export type LoginResult =
  | {
      needsTwoFactor: true;
      method: "EMAIL" | "GOOGLE_AUTH";
      mfaToken: string;
    }
  | ({ needsTwoFactor: false } & AuthTokens);

async function issueRefreshToken(
  userId: string,
  meta?: RequestMeta,
): Promise<string> {
  const token = randomOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });
  return token;
}

/** Revokes every active refresh token for a user (used on replay detection). */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function buildAuthTokens(
  user: User,
  meta?: RequestMeta,
): Promise<AuthTokens> {
  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
  });
  const refreshToken = await issueRefreshToken(user.id, meta);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return { accessToken, refreshToken, user: publicUser(user) };
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { email: true },
  });
  if (existing) {
    throw conflict(
      existing.email === input.email
        ? "Email is already registered"
        : "Username is already in use",
    );
  }
  const password = await hashPassword(input.password);
  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target
        : [err.meta?.target];
      throw conflict(
        target.includes("email")
          ? "Email is already registered"
          : "Username is already in use",
      );
    }
    throw err;
  }
  const defaultTenant = await prisma.tenant.findUnique({
    where: { slug: process.env.DEFAULT_TENANT_SLUG || "default" },
    select: { id: true },
  });
  const code = await issueOtp(user.id, OtpPurpose.EMAIL_VERIFICATION);
  // The account is already committed; a failed verification email must not
  // surface as a registration error (the user can resend the code).
  await bestEffort("email.verification", sendVerificationEmail(user.email, code));
  // TENANT ONBOARDING: self-registered learners join the open default tenant
  // (slug from DEFAULT_TENANT_SLUG, seeded as "default") with STUDENT
  // authority. All other tenants remain strictly membership-gated; if the
  // default tenant does not exist the user simply has no tenant access yet.
  if (defaultTenant) {
    // Synchronous (not bestEffort): the learner's very next request may
    // already be a tenant-scoped operation that requires this row.
    await prisma.tenantMembership
      .upsert({
        where: {
          userId_tenantId: { userId: user.id, tenantId: defaultTenant.id },
        },
        update: {},
        create: { userId: user.id, tenantId: defaultTenant.id, role: "STUDENT" },
      })
      .catch(() => {});
  }
  return publicUser(user);
}

export async function loginUser(
  input: { username: string; password: string },
  meta?: RequestMeta,
): Promise<LoginResult> {
  // Search by email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: input.username },
        { username: input.username },
      ],
    },
  });
  if (!user) throw unauthorized("Invalid username or password");
  if (user.isBanned) throw forbidden("This account has been suspended");

  const valid = await verifyPassword(input.password, user.password);
  if (!valid) throw unauthorized("Invalid username or password");

  if (user.twoStep === TWO_STEP.EMAIL) {
    const code = await issueOtp(user.id, OtpPurpose.LOGIN);
    // The code is the only way in — surface a clear error when it cannot be
    // delivered instead of a raw provider failure.
    if (!(await bestEffort("email.login_otp", sendLoginOtpEmail(user.email, code)))) {
      throw serviceUnavailable(
        "Could not send your login code. Please try again in a minute.",
      );
    }
    return {
      needsTwoFactor: true,
      method: "EMAIL",
      mfaToken: await signMfaToken(user.id),
    };
  }
  if (user.twoStep === TWO_STEP.GOOGLE_AUTH) {
    return {
      needsTwoFactor: true,
      method: "GOOGLE_AUTH",
      mfaToken: await signMfaToken(user.id),
    };
  }
  return {
    needsTwoFactor: false,
    ...(await buildAuthTokens(user, meta)),
  };
}

export async function completeLoginWithOtp(
  input: { token: string; code: string },
  meta?: RequestMeta,
): Promise<AuthTokens> {
  const userId = await verifyMfaToken(input.token);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized("Invalid session");
  if (user.isBanned) throw forbidden("This account has been suspended");

  if (user.twoStep === TWO_STEP.EMAIL) {
    await verifyOtp(user.id, OtpPurpose.LOGIN, input.code);
  } else if (user.twoStep === TWO_STEP.GOOGLE_AUTH) {
    let secret: string;
    try {
      secret = decryptSecret(user.twoStepSecret ?? "");
    } catch {
      throw internal("Two-step verification is temporarily unavailable");
    }
    if (!secret || !verifyTotp(secret, input.code)) {
      throw badRequest("Invalid code");
    }
  } else {
    throw badRequest("Two-step verification is not enabled");
  }
  return buildAuthTokens(user, meta);
}

export async function refreshTokens(
  refreshTokenValue: string,
  meta?: RequestMeta,
): Promise<AuthTokens> {
  if (!refreshTokenValue) throw unauthorized("Missing refresh token");
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshTokenValue) },
    include: { user: true },
  });
  if (!record || record.expiresAt < new Date()) {
    throw unauthorized("Session expired");
  }
  if (record.user.isBanned) throw forbidden("This account has been suspended");

  const consumed = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (consumed.count === 0) {
    logError(
      new Error("Refresh token reuse detected — revoking all active sessions"),
      { method: "refresh", userId: record.user.id },
    );
    await revokeAllRefreshTokens(record.user.id);
    throw unauthorized("Session expired");
  }
  const refreshToken = await issueRefreshToken(record.user.id, meta);
  const accessToken = await signAccessToken({
    userId: record.user.id,
    role: record.user.role,
  });
  return { accessToken, refreshToken, user: publicUser(record.user) };
}

export async function logout(refreshTokenValue: string): Promise<void> {
  if (!refreshTokenValue) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshTokenValue), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
