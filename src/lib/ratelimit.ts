/**
 * Distributed rate limiting and quotas backed by Upstash Redis.
 *
 * Fail-closed behavior: in production the Upstash configuration is REQUIRED.
 * If it is missing, requests are rejected with 503 rather than allowed through
 * unthrottled (which would let one user burn the entire AI budget). In
 * development, a per-process in-memory store is used so the app runs without
 * external services.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serviceUnavailable, tooMany } from "./errors";

const WINDOW_MS = 60_000;
const DAILY_MS = 24 * 60 * 60 * 1000;
const DEV_LIMIT = 30;
const DEFAULT_ROADMAP_RPM = 10;
const DEFAULT_ROADMAP_DAILY = 5;

const devStore = new Map<string, { count: number; resetAt: number }>();
let ratelimit: Ratelimit | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Returns the Upstash Redis client, or null (dev fallback) when unconfigured. */
function redisFromEnv(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (isProduction()) {
      // Fail closed: never silently disable throttling in production.
      throw serviceUnavailable("Rate limiting is not configured");
    }
    return null;
  }
  return Redis.fromEnv();
}

function devIncrement(key: string, limit: number): void {
  const now = Date.now();
  const bucket = devStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    devStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= limit) throw tooMany("Too many requests");
  bucket.count += 1;
}

function devDailyIncrement(key: string, limit: number): void {
  const now = Date.now();
  const bucket = devStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    devStore.set(key, { count: 1, resetAt: now + DAILY_MS });
    return;
  }
  if (bucket.count >= limit) throw tooMany("Daily limit reached");
  bucket.count += 1;
}

/**
 * Enforces a sliding-window rate limit for a key. Uses Upstash when enabled,
 * otherwise a simple in-memory fallback suitable for development.
 */
export async function enforceRateLimit(key: string): Promise<void> {
  const rl = ratelimit ?? upstashRatelimit();
  if (rl) {
    const { success } = await rl.limit(key);
    if (!success) throw tooMany("Too many requests");
    return;
  }
  devIncrement(key, DEV_LIMIT);
  cleanupDevStore();
}

/** Sliding-window per-user limit on AI roadmap generations. */
export async function enforceRoadmapRateLimit(userId: string): Promise<void> {
  const limit = Number(process.env.ROADMAP_RATE_LIMIT_PER_MIN ?? DEFAULT_ROADMAP_RPM);
  const redis = redisFromEnv();
  if (redis) {
    const rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, "60 s"),
      prefix: "ratelimit:roadmap",
    });
    const { success } = await rl.limit(userId);
    if (!success) throw tooMany("Too many requests. Please wait a moment.");
    return;
  }
  devIncrement(`roadmap:${userId}`, limit);
  cleanupDevStore();
}

/**
 * Per-user daily budget on AI roadmap generations (cost control for the free
 * Gemini tier). Counts attempts, not just successes.
 */
export async function enforceRoadmapDailyQuota(userId: string): Promise<void> {
  const limit = Number(process.env.ROADMAP_DAILY_LIMIT ?? DEFAULT_ROADMAP_DAILY);
  const redis = redisFromEnv();
  const key = `roadmap:daily:${userId}`;
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, Math.floor(DAILY_MS / 1000));
    if (count > limit) {
      throw tooMany(`Daily roadmap generation limit (${limit}) reached. Try again tomorrow.`);
    }
    return;
  }
  devDailyIncrement(key, limit);
  cleanupDevStore();
}

function cleanupDevStore(): void {
  if (devStore.size <= 1_000) return;
  const now = Date.now();
  for (const [k, v] of devStore) {
    if (v.resetAt <= now) devStore.delete(k);
  }
}

function upstashRatelimit(): Ratelimit | null {
  if (process.env.RATE_LIMIT_ENABLED !== "true") return null;
  const redis = redisFromEnv();
  if (!redis) return null;
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(DEV_LIMIT, "60 s"),
    prefix: "ratelimit:elearning",
  });
  return ratelimit;
}
