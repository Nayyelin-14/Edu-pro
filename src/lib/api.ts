import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";
import { incrementMetric } from "./metrics";

/**
 * Wraps a route handler body, converting thrown ApiError / ZodError into a
 * consistent JSON envelope and unexpected errors into a 500. Propagates the
 * caller-supplied x-request-id (or generates one) on the response so requests
 * can be correlated across logs.
 */
export async function run<T>(
  fn: () => Promise<T> | T,
  opts?: { req?: NextRequest },
): Promise<NextResponse> {
  const started = performance.now();
  const req = opts?.req;
  const requestId =
    req?.headers.get("x-request-id")?.trim() || randomUUID();
  incrementMetric("http.requests");
  try {
    const data = await fn();
    const res =
      data instanceof NextResponse
        ? data
        : NextResponse.json({ isSuccess: true, data });
    res.headers.set("x-request-id", requestId);
    incrementMetric("http.responses");
    if (req) {
      const { logRequest } = await import("./logger");
      logRequest(req, res.status, performance.now() - started, { requestId });
    }
    return res;
  } catch (err) {
    const res = toErrorResponse(err);
    res.headers.set("x-request-id", requestId);
    incrementMetric("http.errors");
    if (req) {
      const { logRequest } = await import("./logger");
      logRequest(req, res.status, performance.now() - started, {
        requestId,
        error: err,
      });
    }
    return res;
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

/**
 * Resolves the client IP from proxy headers. Fail closed: when TRUST_PROXY is
 * not explicitly "true", the spoofable x-forwarded-for / x-real-ip headers are
 * ignored entirely and "unknown" is returned (used only for rate-limit keys and
 * audit logs — never for authorization).
 *
 * With TRUST_PROXY=true the header set by the hosting proxy is trusted:
 *  1. x-vercel-forwarded-for (Vercel) when present.
 *  2. The RIGHTMOST x-forwarded-for entry — proxies append the client IP, so
 *     the leftmost value is attacker-controlled and must not be used.
 *  3. x-real-ip as a last resort.
 */
export function resolveClientIp(
  headers: Pick<Headers, "get">,
  trustProxy: boolean,
): string {
  if (!trustProxy) return "unknown";
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const rightmost = entries[entries.length - 1];
    if (rightmost) return rightmost;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim() || "unknown";
  return "unknown";
}

export function getIp(req: NextRequest): string {
  return resolveClientIp(req.headers, process.env.TRUST_PROXY === "true");
}

export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "";
}
