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

export async function provisionFreshTestDatabase(): Promise<void> {
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
