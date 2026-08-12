import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { tooMany } from "./errors";

const WINDOW_MS = 60_000;
const DEV_LIMIT = 30;

const devStore = new Map<string, { count: number; resetAt: number }>();
let ratelimit: Ratelimit | null = null;

function upstashRatelimit(): Ratelimit | null {
  if (process.env.RATE_LIMIT_ENABLED !== "true") return null;
  if (ratelimit) return ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "ratelimit:elearning",
  });
  return ratelimit;
}

function devLimit(key: string): void {
  const now = Date.now();
  const bucket = devStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    devStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= DEV_LIMIT) throw tooMany("Too many requests");
  bucket.count += 1;
}

/**
 * Enforces a sliding-window rate limit for a key. Uses Upstash when enabled,
 * otherwise a simple in-memory fallback suitable for development.
 */
export async function enforceRateLimit(key: string): Promise<void> {
  const rl = upstashRatelimit();
  if (rl) {
    const { success } = await rl.limit(key);
    if (!success) throw tooMany("Too many requests");
    return;
  }
  devLimit(key);
  if (devStore.size > 1_000) {
    // best-effort cleanup to avoid unbounded growth in dev
    for (const [k, v] of devStore) {
      if (v.resetAt <= Date.now()) devStore.delete(k);
    }
  }
}
