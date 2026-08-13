/**
 * Unit tests for the roadmap rate limit and daily quota, including the
 * fail-closed behavior when Upstash is missing in production.
 */
import { after, before, test } from "node:test";
import assert from "node:assert";
import { ApiError } from "@/lib/errors";
import { enforceRoadmapDailyQuota, enforceRoadmapRateLimit } from "@/lib/ratelimit";

before(() => {
  // Force the in-memory dev fallback (never touch a real Upstash instance).
  (process.env as Record<string, string>).NODE_ENV = "development";
  process.env.RATE_LIMIT_ENABLED = "false";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

after(() => {
  (process.env as Record<string, string>).NODE_ENV = "development";
});

function expectStatus(status: number) {
  return (err: unknown): boolean => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    assert.strictEqual((err as ApiError).statusCode, status);
    return true;
  };
}

test("dev rate limit rejects requests beyond the per-minute cap with 429", async () => {
  process.env.ROADMAP_RATE_LIMIT_PER_MIN = "2";
  await enforceRoadmapRateLimit("rl-user-1");
  await enforceRoadmapRateLimit("rl-user-1");
  await assert.rejects(enforceRoadmapRateLimit("rl-user-1"), expectStatus(429));
});

test("dev rate limit is per-user", async () => {
  process.env.ROADMAP_RATE_LIMIT_PER_MIN = "1";
  await enforceRoadmapRateLimit("rl-user-2");
  await assert.rejects(enforceRoadmapRateLimit("rl-user-2"), expectStatus(429));
  await enforceRoadmapRateLimit("rl-user-3"); // different user unaffected
});

test("dev daily quota rejects beyond the daily cap with 429", async () => {
  process.env.ROADMAP_DAILY_LIMIT = "2";
  await enforceRoadmapDailyQuota("dq-user-1");
  await enforceRoadmapDailyQuota("dq-user-1");
  await assert.rejects(enforceRoadmapDailyQuota("dq-user-1"), expectStatus(429));
});

test("dev daily quota is per-user", async () => {
  process.env.ROADMAP_DAILY_LIMIT = "1";
  await enforceRoadmapDailyQuota("dq-user-2");
  await assert.rejects(enforceRoadmapDailyQuota("dq-user-2"), expectStatus(429));
  await enforceRoadmapDailyQuota("dq-user-3"); // different user unaffected
});

test("in production, missing Upstash config fails closed with 503", async () => {
  (process.env as Record<string, string>).NODE_ENV = "production";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  await assert.rejects(enforceRoadmapRateLimit("prod-user"), expectStatus(503));
  await assert.rejects(enforceRoadmapDailyQuota("prod-user"), expectStatus(503));
});