import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

/**
 * Wraps a route handler body, converting thrown ApiError / ZodError into a
 * consistent JSON envelope and unexpected errors into a 500.
 */
export async function run<T>(
  fn: () => Promise<T> | T,
): Promise<NextResponse> {
  try {
    const data = await fn();
    if (data instanceof NextResponse) return data;
    return NextResponse.json({ isSuccess: true, data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { isSuccess: false, message: err.message, errors: err.errors },
      { status: err.statusCode },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { isSuccess: false, message: "Validation failed", errors: err.issues },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    { isSuccess: false, message: "Internal server error" },
    { status: 500 },
  );
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ isSuccess: true, data }, init);
}

export async function parseBody<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "";
}
