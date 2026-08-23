import type { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight request/error logging helper.
 *
 * - In production logs single-line JSON for easy ingestion.
 * - In development logs a readable one-liner.
 * - Never logs sensitive request bodies; only method, path, status, duration
 *   and optionally a user id / ip.
 */

const isProduction = process.env.NODE_ENV === "production";

const REDACTED = [
  "authorization",
  "cookie",
  "stripe-signature",
  "x-api-key",
];

function redactHeader(name: string): boolean {
  return REDACTED.includes(name.toLowerCase());
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)}µs`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function logRequest(
  req: NextRequest,
  status: number,
  durationMs: number,
  meta?: { userId?: string; error?: unknown; requestId?: string },
) {
  const url = req.nextUrl;
  const entry = {
    ts: new Date().toISOString(),
    level: "info",
    requestId: meta?.requestId ?? undefined,
    method: req.method,
    path: url.pathname,
    query: url.search,
    status,
    durationMs: Math.round(durationMs),
    userId: meta?.userId ?? undefined,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };

  if (isProduction) {
    console.log(JSON.stringify(entry));
  } else {
    console.log(
      `[api] ${req.method} ${url.pathname}${url.search} → ${status} (${formatDuration(durationMs)})${meta?.requestId ? ` [${meta.requestId}]` : ""}`,
    );
  }

  if (meta?.error !== undefined && meta.error !== null) {
    logError(meta.error, {
      method: req.method,
      path: url.pathname,
      requestId: meta.requestId,
    });
  }
}

export function logError(
  err: unknown,
  context?: {
    method?: string;
    path?: string;
    userId?: string;
    requestId?: string;
  },
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const entry = {
    ts: new Date().toISOString(),
    level: "error",
    message,
    ...context,
    ...(stack ? { stack } : {}),
  };
  if (isProduction) {
    console.error(JSON.stringify(entry));
  } else {
    console.error(`[api] error: ${message}`, context ?? "");
  }
}

/**
 * Wraps a Next.js route handler with request logging. Returns a handler that
 * logs method, path, status and duration (and any error) after completion.
 */
export function withRequestLogging(
  handler: (
    req: NextRequest,
    ctx?: unknown,
  ) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    const started = performance.now();
    try {
      const res = await handler(req, ctx);
      logRequest(req, res.status, performance.now() - started);
      return res;
    } catch (err) {
      const res = (await import("./api")).toErrorResponse(err);
      logRequest(req, res.status, performance.now() - started, { error: err });
      return res;
    }
  };
}

/** Snapshot of safe request metadata (no bodies or sensitive headers). */
export function summarizeHeaders(req: NextRequest): Record<string, string> {
  const result: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!redactHeader(key)) result[key] = value;
  });
  return result;
}