import type { User } from "@/generated/prisma/client";
import { OtpPurpose, TWO_STEP } from "@/generated/prisma/enums";
import { sendLoginOtpEmail } from "@/lib/email";
import { bestEffort } from "@/lib/async";
import { badRequest, internal, serviceUnavailable } from "@/lib/errors";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { encryptSecret } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, provisioningUri, verifyTotp } from "@/lib/totp";

export async function initEnableTwoStep(
  user: User,
  method: "EMAIL" | "GOOGLE_AUTH",
): Promise<
  | { pending: true; method: "EMAIL" }
  | { pending: true; method: "GOOGLE_AUTH"; totpSecret: string; uri: string }
> {
  if (method === "EMAIL") {
    const code = await issueOtp(user.id, OtpPurpose.TWO_FACTOR);
    if (!(await bestEffort("email.login_otp", sendLoginOtpEmail(user.email, code)))) {
      throw serviceUnavailable(
        "Could not send your verification code. Please try again in a minute.",
      );
    }
    return { pending: true, method: "EMAIL" };
  }
  const secret = generateTotpSecret();
  return {
    pending: true,
    method: "GOOGLE_AUTH",
    totpSecret: secret,
    uri: provisioningUri(secret, user.email),
  };
}

export async function confirmEnableTwoStep(
  user: User,
  input: {
    method: "EMAIL" | "GOOGLE_AUTH";
    code: string;
    totpSecret?: string;
  },
): Promise<{ twoStep: "EMAIL" | "GOOGLE_AUTH" }> {
  if (input.method === "EMAIL") {
    await verifyOtp(user.id, OtpPurpose.TWO_FACTOR, input.code);
    await prisma.user.update({
      where: { id: user.id },
      data: { twoStep: TWO_STEP.EMAIL, twoStepSecret: null },
    });
    return { twoStep: TWO_STEP.EMAIL };
  }
  if (!input.totpSecret || !verifyTotp(input.totpSecret, input.code)) {
    throw badRequest("Invalid code");
  }
  let storedSecret: string;
  try {
    storedSecret = encryptSecret(input.totpSecret);
  } catch {
    // Fail closed: never persist a 2FA secret in plaintext.
    throw internal("Two-step verification is temporarily unavailable");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoStep: TWO_STEP.GOOGLE_AUTH,
      twoStepSecret: storedSecret,
    },
  });
  return { twoStep: TWO_STEP.GOOGLE_AUTH };
}

export async function disableTwoStep(
  user: User,
  password: string,
): Promise<{ twoStep: "DISABLED" }> {
  const valid = await verifyPassword(password, user.password);
  if (!valid) throw badRequest("Incorrect password");
  await prisma.user.update({
    where: { id: user.id },
    data: { twoStep: TWO_STEP.DISABLED, twoStepSecret: null },
  });
  return { twoStep: TWO_STEP.DISABLED };
}

export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw badRequest("Current password is incorrect");
  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
