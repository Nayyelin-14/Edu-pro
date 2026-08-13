/**
 * Unit tests for the Gemini provider's HTTP behavior:
 * header-based auth, retry/backoff, and 429/4xx/5xx/network error mapping.
 */
import { afterEach, test } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { PlannerContext } from "@/lib/ai/provider";
import { ApiError } from "@/lib/errors";

function response(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(): PlannerContext {
  return {
    goal: "Become a TypeScript developer",
    skills: ["typescript"],
    level: "BEGINNER",
    durationWeeks: 8,
    hoursPerWeek: 6,
    language: "en",
    candidates: [],
    progress: new Map(),
  };
}

const VALID_PLAN = {
  title: "TypeScript Roadmap",
  summary: "A structured path.",
  stages: [
    {
      stageNumber: 1,
      title: "TypeScript fundamentals",
      description: "Basics.",
      goal: "Get started",
      weekStart: 1,
      weekEnd: 2,
      courseKey: null,
      reason: "No matching course.",
      isTopic: true,
    },
  ],
};

function makeProvider(): GeminiProvider {
  return new GeminiProvider({ apiKey: "secret-test-key", model: "gemini-test", maxRetries: 1 });
}

function asApiError(err: unknown, status: number): void {
  assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
  assert.strictEqual((err as ApiError).statusCode, status);
}

afterEach(() => {
  mock.restoreAll();
});

test("sends the key via x-goog-api-key header (never in the URL) and parses the plan", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    response(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_PLAN) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    }),
  );
  const logMock = mock.method(console, "log", () => {});

  const plan = await makeProvider().generateRoadmap(ctx());

  assert.strictEqual(plan.title, VALID_PLAN.title);
  const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
  assert.match(url, /:generateContent$/);
  assert.doesNotMatch(url, /key=/);
  const headers = (init.headers ?? {}) as Record<string, string>;
  assert.strictEqual(headers["x-goog-api-key"], "secret-test-key");
  assert.ok(
    logMock.mock.calls.some((c) => String(c.arguments[0]).includes("gemini.completion")),
    "usage metadata should be logged",
  );
});

test("a 429 maps to ApiError 429 without a retry", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => response(429, { error: {} }));
  await assert.rejects(makeProvider().generateRoadmap(ctx()), (err: unknown) => {
    asApiError(err, 429);
    return true;
  });
  assert.strictEqual(fetchMock.mock.callCount(), 1);
});

test("a permanent 4xx maps to ApiError 400 without a retry", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => response(400, { error: { message: "bad key" } }));
  await assert.rejects(makeProvider().generateRoadmap(ctx()), (err: unknown) => {
    asApiError(err, 400);
    return true;
  });
  assert.strictEqual(fetchMock.mock.callCount(), 1);
});

test("a 5xx is retried once, then maps to ApiError 502", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => response(503, { error: {} }));
  await assert.rejects(makeProvider().generateRoadmap(ctx()), (err: unknown) => {
    asApiError(err, 502);
    return true;
  });
  assert.strictEqual(fetchMock.mock.callCount(), 2, "must retry the 5xx once");
});

test("a transient 5xx followed by success returns the plan", async () => {
  let calls = 0;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return calls === 1
      ? response(500, { error: {} })
      : response(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_PLAN) }] } }] });
  });
  const plan = await makeProvider().generateRoadmap(ctx());
  assert.strictEqual(plan.title, VALID_PLAN.title);
  assert.strictEqual(fetchMock.mock.callCount(), 2);
});

test("a network error is retried once, then maps to ApiError 502", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("ECONNREFUSED");
  });
  await assert.rejects(makeProvider().generateRoadmap(ctx()), (err: unknown) => {
    asApiError(err, 502);
    return true;
  });
  assert.strictEqual(fetchMock.mock.callCount(), 2);
});

test("a timeout (AbortError) is retried once, then maps to ApiError 502", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  });
  await assert.rejects(makeProvider().generateRoadmap(ctx()), (err: unknown) => {
    asApiError(err, 502);
    assert.match((err as Error).message, /timed out/);
    return true;
  });
  assert.strictEqual(fetchMock.mock.callCount(), 2);
});

test("a 200 with no content maps to ApiError 502", async () => {
  mock.method(globalThis, "fetch", async () => response(200, { candidates: [] }));
  await assert.rejects(makeProvider().generateRoadmap(ctx()), (err: unknown) => {
    asApiError(err, 502);
    return true;
  });
});
