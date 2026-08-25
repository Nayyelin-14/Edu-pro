/**
 * Provisions the throwaway test database (async).
 *
 * Recreates `elearning_test` from scratch and syncs the Prisma schema via
 * `prisma db push` (no migration history table required). Recreating the
 * schema on each invocation doubles as a fresh-database verification.
 */
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getMainAdminUrl, getTestAdminUrl } from "./setup-test-env";

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
  // Ensure the throwaway database exists (Neon-safe: CREATE DATABASE outside a
  // transaction; ignore "already exists").
  const main = new Client({ connectionString: getMainAdminUrl() });
  await main.connect();
  try {
    await main.query('CREATE DATABASE "elearning_test"');
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== "42P04") throw err;
  } finally {
    await main.end();
  }

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
  // Use `db push` rather than `migrate deploy`: the throwaway test database is
  // recreated from scratch each run, so there is no `_prisma_migrations`
  // history table (which `migrate deploy` requires and would fail with P1014).
  // `db push` syncs the schema from prisma/schema.prisma directly.
  execFileSync(prismaBin, ["db", "push", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: getTestAdminUrl() },
    stdio: "pipe",
  });
}

// Allow `npx tsx tests/helpers/provision-test-db.ts` to run standalone in CI
// (the integration script invokes it once per test file).
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  provisionFreshTestDatabase()
    .then(() => {
      console.log("Test database provisioned.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
