/**
 * Integration-test environment bootstrap (side-effect on import).
 *
 * Loads .env and resolves the app's DATABASE_URL to a dedicated throwaway
 * database (`elearning_test`) so tests never touch the dev database.
 *
 * Import this BEFORE any code that issues a Prisma query. The Prisma client is
 * lazy, so setting process.env.DATABASE_URL here is sufficient.
 */
import "dotenv/config";

const TEST_DB = "elearning_test";

function withDb(url: string, db: string): string {
  return url.replace(/\/[^/?]+(\?|$)/, `/${db}$1`);
}

/** Pooled test URL (the normal production-style connection path). */
export function getTestDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  return withDb(base, TEST_DB);
}

/** Direct (non-pooled) test URL, used only for DDL like CREATE DATABASE. */
export function getTestAdminUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  return withDb(base, TEST_DB).replace("-pooler", "");
}

/** Direct (non-pooled) admin URL for the *application* database — used to
 * create the throwaway `elearning_test` database if it does not exist yet. */
export function getMainAdminUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  return base.replace("-pooler", "");
}
