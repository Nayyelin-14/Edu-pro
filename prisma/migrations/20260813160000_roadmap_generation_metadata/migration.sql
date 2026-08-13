-- AlterEnum: new UsageSource enum for roadmap generation metadata.
BEGIN;
CREATE TYPE "UsageSource" AS ENUM ('provider_reported', 'calculated', 'unavailable');
COMMIT;

-- AlterTable: durable AI generation metadata on Roadmap (all nullable so legacy
-- rows and unknown values render as "Not available", never as zero).
ALTER TABLE "Roadmap"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "inputTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "totalTokens" INTEGER,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "generatedAt" TIMESTAMP(3),
  ADD COLUMN "usageSource" "UsageSource",
  ADD COLUMN "attemptCount" INTEGER,
  ADD COLUMN "retryCount" INTEGER;
