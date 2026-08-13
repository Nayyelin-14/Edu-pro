/**
 * Tests for the transparent session-refresh interceptor in apiFetch.
 *
 * The access_token JWT is short-lived; on a 401 from a non-auth endpoint the
 * client should rotate the session once via /api/auth/refresh and retry the
 * original request. Concurrent 401s share a single refresh.
 */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert";
import { apiFetch } from "@/lib/api-client";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let calls: { url: string; init?: RequestInit }[] = [];
let refreshCount = 0;

beforeEach(() => {
  calls = [];
  refreshCount = 0;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u === "/api/auth/refresh") {
      refreshCount += 1;
      return jsonResponse(200, { isSuccess: true, data: { user: null } });
    }
    if (u === "/api/roadmaps") {
      if (refreshCount === 0) {
        return jsonResponse(401, { isSuccess: false, message: "Unauthorized" });
      }
      return jsonResponse(200, { isSuccess: true, data: [{ id: "r1" }] });
    }
    return jsonResponse(404, { isSuccess: false, message: "Not found" });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("refreshes the session once and retries the original request on a 401", async () => {
  const data = await apiFetch<{ id: string }[]>("/api/roadmaps");
  assert.deepStrictEqual(data, [{ id: "r1" }]);
  assert.strictEqual(refreshCount, 1);
  assert.deepStrictEqual(
    calls.map((c) => c.url),
    ["/api/roadmaps", "/api/auth/refresh", "/api/roadmaps"],
  );
  // localStorage is unavailable under node:test, so getRememberMe() defaults to
  // true and the refresh request must carry { remember: true }.
  const refreshCall = calls.find((c) => c.url === "/api/auth/refresh");
  assert.ok(refreshCall);
  assert.strictEqual(refreshCall.init?.body, JSON.stringify({ remember: true }));
});

test("concurrent 401s share a single refresh", async () => {
  const [a, b] = await Promise.all([
    apiFetch<unknown[]>("/api/roadmaps"),
    apiFetch<unknown[]>("/api/roadmaps"),
  ]);
  assert.deepStrictEqual(a, [{ id: "r1" }]);
  assert.deepStrictEqual(b, [{ id: "r1" }]);
  assert.strictEqual(refreshCount, 1);
});

test("never refreshes for auth endpoints", async () => {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u === "/api/auth/login") {
      return jsonResponse(401, { isSuccess: false, message: "Unauthorized" });
    }
    return jsonResponse(404, { isSuccess: false, message: "Not found" });
  }) as typeof fetch;

  await assert.rejects(
    () => apiFetch("/api/auth/login", { method: "POST" }),
    (err: Error) => err instanceof Error && err.message === "Unauthorized",
  );
  assert.strictEqual(refreshCount, 0);
});

test("a failed refresh surfaces the original 401 without retrying the request", async () => {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u === "/api/auth/refresh") {
      refreshCount += 1;
      return jsonResponse(401, { isSuccess: false, message: "Session expired" });
    }
    return jsonResponse(401, { isSuccess: false, message: "Unauthorized" });
  }) as typeof fetch;

  await assert.rejects(
    () => apiFetch<unknown[]>("/api/roadmaps"),
    (err: Error) => err instanceof Error && err.message === "Unauthorized",
  );
  assert.strictEqual(refreshCount, 1);
});
