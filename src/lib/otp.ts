import { prisma } from "./prisma";
import { sha256, randomOtp } from "./crypto";
import { ApiError, tooMany } from "./errors";
import { OtpPurpose } from "@/generated/prisma/enums";

export type OtpPurposeValue = (typeof OtpPurpose)[keyof typeof OtpPurpose];

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function issueOtp(
  userId: string,
  purpose: OtpPurposeValue,
): Promise<string> {
  const recent = await prisma.otpCode.findFirst({
    where: { userId, purpose, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (recent) throw tooMany("Please wait before requesting another code");

  const code = randomOtp();
  await prisma.otpCode.create({
    data: {
      userId,
      purpose,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  return code;
}

export async function verifyOtp(
  userId: string,
  purpose: OtpPurposeValue,
  code: string,
): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw new ApiError(400, "Invalid or expired code");
  if (record.attempts >= MAX_ATTEMPTS) {
    throw tooMany("Too many attempts. Request a new code.");
  }
  if (sha256(code) !== record.codeHash) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, "Invalid code");
  }
  await prisma.otpCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
}
