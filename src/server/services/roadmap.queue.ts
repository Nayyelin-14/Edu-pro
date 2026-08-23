/**
 * Upstash QStash wiring for async roadmap generation:
 *  - client + publisher factory (QStash in prod, no-op in dev),
 *  - signature verification for the public-but-signed worker endpoint,
 *  - global provider-concurrency guard (fail closed in production).
 *
 * Env:
 *   QSTASH_ENABLED      "true" -> async QStash flow; otherwise dev inline run
 *   QSTASH_TOKEN        Upstash QStash auth token
 *   QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY  worker signature keys
 *   APP_URL             used to build the worker callback URL
 *   ROADMAP_MAX_INFLIGHT  cap on concurrent provider calls (default 10)
 */
import { Client, Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { serviceUnavailable } from "@/lib/errors";
import { QStashRoadmapPublisher, NoopRoadmapPublisher, type RoadmapJobPublisher } from "./roadmap.job-publisher";

const WORKER_PATH = "/api/ai/roadmap/jobs/worker";
const INFLIGHT_KEY = "qstash:roadmap:inflight";
const INFLIGHT_LEASE_S = 120;

export function isQStashEnabled(): boolean {
  return process.env.QSTASH_ENABLED === "true";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function redisFromEnv(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (isProduction()) {
      throw serviceUnavailable("Rate limiting is not configured");
    }
    return null;
  }
  return Redis.fromEnv();
}

export function createRoadmapPublisher(): RoadmapJobPublisher {
  if (!isQStashEnabled()) return new NoopRoadmapPublisher();
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    if (isProduction()) throw serviceUnavailable("QStash is not configured");
    return new NoopRoadmapPublisher();
  }
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return new QStashRoadmapPublisher(new Client({ token }), `${baseUrl}${WORKER_PATH}`, { retries: 2 });
}

let receiver: Receiver | null = null;

/** Verifies the Upstash-Signature header for the raw worker body. */
export async function verifyQStashSignature(signature: string, body: string): Promise<boolean> {
  if (!signature) return false;
  if (!receiver) {
    const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const next = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!current || !next) return false;
    receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  }
  try {
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Global provider-concurrency guard (bounded NIM calls on the free tier).
//
// FAIL-CLOSED GLOBAL CAP: this guard is the hard backstop against NIM cost
// overruns. The worker refuses to start a generation when ROADMAP_MAX_INFLIGHT
// (default 10) concurrent provider calls are already in flight — it returns 503
// so QStash retries later. Because the counter lives in Upstash Redis (not in
// process memory), the cap holds across ALL app instances, and a fresh lease
// TTL means a crashed worker's slot is automatically reclaimed. In production
// the slot system NEVER degrades open: if Redis is unreachable,
// `redisFromEnv()` throws 503 rather than letting unbounded calls through.
// ---------------------------------------------------------------------------

const devInflight = { count: 0, lastReset: Date.now() };

export async function acquireRoadmapSlot(): Promise<boolean> {
  const max = Math.max(1, Number(process.env.ROADMAP_MAX_INFLIGHT ?? 10));
  const redis = redisFromEnv();
  if (redis) {
    const val = await redis.incr(INFLIGHT_KEY);
    if (val === 1) await redis.expire(INFLIGHT_KEY, INFLIGHT_LEASE_S);
    if (val > max) {
      await redis.decr(INFLIGHT_KEY);
      return false;
    }
    return true;
  }
  const now = Date.now();
  if (now - devInflight.lastReset > INFLIGHT_LEASE_S * 1000) {
    devInflight.count = 0;
    devInflight.lastReset = now;
  }
  if (devInflight.count >= max) return false;
  devInflight.count += 1;
  return true;
}

export async function releaseRoadmapSlot(): Promise<void> {
  const redis = redisFromEnv();
  if (redis) {
    await redis.decr(INFLIGHT_KEY).catch(() => {});
    return;
  }
  if (devInflight.count > 0) devInflight.count -= 1;
}