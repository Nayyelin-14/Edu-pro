import type { User } from "@/generated/prisma/client";
import { OtpPurpose, TWO_STEP } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth";
import { REFRESH_TTL_MS, publicUser } from "@/lib/auth";
import { sha256, randomOpaqueToken } from "@/lib/crypto";
import { sendLoginOtpEmail, sendVerificationEmail } from "@/lib/email";
import { badRequest, conflict, forbidden, unauthorized } from "@/lib/errors";
import { signAccessToken, signMfaToken, verifyMfaToken } from "@/lib/jwt";
import { issueOtp, verifyOtp } from "@/lib/otp";
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
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      password,
    },
  });
  const code = await issueOtp(user.id, OtpPurpose.EMAIL_VERIFICATION);
  await sendVerificationEmail(user.email, code);
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
    await sendLoginOtpEmail(user.email, code);
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
    if (!user.twoStepSecret || !verifyTotp(user.twoStepSecret, input.code)) {
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
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthorized("Session expired");
  }
  if (record.user.isBanned) throw forbidden("This account has been suspended");

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
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
