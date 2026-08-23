/**
 * Provisions the throwaway test database (async).
 *
 * Recreates `elearning_test` from scratch and applies every committed
 * migration via `prisma migrate deploy`. Recreating on each invocation
 * doubles as the "migration deployment on a fresh database" verification.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Client } from "pg";
import { getTestAdminUrl } from "./setup-test-env";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function provisionFreshTestDatabase(): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await provisionOnce();
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastErr;
}

async function provisionOnce(): Promise<void> {
  const admin = new Client({ connectionString: getTestAdminUrl() });
  await admin.connect();
  try {
    // Recreate the whole schema instead of dropping the database: dropping the
    // DB fails on Neon while pooled backend connections still hold it open.
    await admin.query("DROP SCHEMA IF EXISTS public CASCADE");
    await admin.query("CREATE SCHEMA public");
  } finally {
    await admin.end();
  }

  const prismaBin = join(process.cwd(), "node_modules", ".bin", "prisma");
  execFileSync(prismaBin, ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: getTestAdminUrl() },
    stdio: "pipe",
  });
}
