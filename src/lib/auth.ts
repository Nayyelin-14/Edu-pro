import { NextResponse } from "next/server";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@/generated/prisma/client";
import type { PublicUser } from "@/types/user";
import { prisma } from "./prisma";
import { verifyAccessToken } from "./jwt";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL) || 900;
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7;
export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Reads and validates the access token cookie. Returns null when absent/invalid. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.isBanned) return null;
  return user;
});

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  remember: boolean,
): NextResponse {
  const secure = isProd();
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    // Scoped so the refresh token is only ever sent to auth endpoints.
    path: "/api/auth",
    ...(remember ? { maxAge: Math.floor(REFRESH_TTL_MS / 1000) } : {}),
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    path: "/api/auth",
    maxAge: 0,
  });
  return res;
}

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    twoStep: user.twoStep,
    emailVerified: user.emailVerifiedAt !== null,
    isBanned: user.isBanned,
    createdAt: user.createdAt.toISOString(),
  };
}

export type { PublicUser };
