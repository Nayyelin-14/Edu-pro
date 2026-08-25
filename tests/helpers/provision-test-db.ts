/**
 * Provisions the throwaway test database (async).
 *
 * Ensures the `elearning_test` database exists, then syncs its schema from
 * `schema.prisma` with `prisma db push` (which avoids the `_prisma_migrations`
 * history-table errors that `migrate deploy` hits on a recreated DB). The two
 * Lesson CHECK constraints that live only in a migration are then re-applied
 * idempotently. The database is reused across runs and kept in sync.
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

  const prismaBin = join(process.cwd(), "node_modules", ".bin", "prisma");
  // Sync the schema from prisma/schema.prisma with `db push`. schema.prisma is
  // the single source of truth for the test database, so it must stay in sync.
  // `db push` does not rely on a `_prisma_migrations` history table, which keeps
  // it robust against the P1014/P3005 errors `migrate deploy` hits on a
  // recreated DB.
  execFileSync(prismaBin, ["db", "push", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: getTestAdminUrl() },
    stdio: "pipe",
  });

  // The Lesson CHECK constraints that enforce single-content-source and
  // type/content coherence live only in a migration (Prisma's @check attribute
  // is unavailable in this Prisma version), so `db push` does not recreate
  // them. Re-apply them idempotently so the test DB matches production
  // behaviour.
  const test = new Client({ connectionString: getTestAdminUrl() });
  await test.connect();
  try {
    await test.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lesson_single_content_source') THEN
        ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_single_content_source" CHECK (
          NOT ("videoUrl" IS NOT NULL AND "article" IS NOT NULL) AND
          NOT ("videoUrl" IS NOT NULL AND "pdfUrl" IS NOT NULL) AND
          NOT ("pdfUrl" IS NOT NULL AND "article" IS NOT NULL)
        );
      END IF;
    END $$;`);
    await test.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lesson_type_content_coherence') THEN
        ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_type_content_coherence" CHECK (
          ("type" = 'READING') OR ("article" IS NULL AND "pdfUrl" IS NULL)
        );
      END IF;
    END $$;`);
  } finally {
    await test.end();
  }
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
