import { jwtVerify, SignJWT } from "jose";
import { ApiError } from "./errors";

const encoder = new TextEncoder();

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT_ACCESS_SECRET is not configured");
  }
  return encoder.encode(secret);
}

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  ttl = "15m",
): Promise<string> {
  return new SignJWT({ type: "access", role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(accessSecret());
}

/** Short-lived token authorizing completion of a 2FA challenge. */
export async function signMfaToken(
  userId: string,
  ttl = "5m",
): Promise<string> {
  return new SignJWT({ type: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(accessSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    if (!payload.sub || payload.type !== "access") {
      throw new ApiError(401, "Invalid token");
    }
    return {
      userId: payload.sub,
      role: String(payload.role ?? "STUDENT"),
    };
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

export async function verifyMfaToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    if (!payload.sub || payload.type !== "mfa") {
      throw new ApiError(401, "Invalid token");
    }
    return payload.sub;
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}
