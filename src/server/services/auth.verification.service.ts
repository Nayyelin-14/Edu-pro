import { OtpPurpose } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth";
import { publicUser } from "@/lib/auth";
import { bestEffort } from "@/lib/async";
import { sha256, randomOpaqueToken } from "@/lib/crypto";
import { appUrl, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { badRequest } from "@/lib/errors";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const RESET_TTL_MS = 60 * 60 * 1000;

export async function verifyEmail(
  userId: string,
  code: string,
): Promise<PublicUser> {
  await verifyOtp(userId, OtpPurpose.EMAIL_VERIFICATION, code);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  return publicUser(user);
}

export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return;
  const code = await issueOtp(user.id, OtpPurpose.EMAIL_VERIFICATION);
  await bestEffort("email.verification", sendVerificationEmail(user.email, code));
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const rawToken = randomOpaqueToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`;
  // The reset token is already committed; a failed email must not surface as
  // an error (the user can request another link).
  if (process.env.NODE_ENV !== "production") {
    // Dev convenience: print the link so the flow is testable without SMTP.
    console.log(`[dev] password reset link for ${user.email}: ${resetUrl}`);
  }
  await bestEffort("email.password_reset", sendPasswordResetEmail(user.email, resetUrl));
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest("Invalid or expired reset token");
  }
  const hashed = await hashPassword(password);
  await prisma.$transaction([
    prisma.passwordReset.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
