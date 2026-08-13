-- AlterEnum: QUEUED added; GENERATING renamed to PROCESSING.
BEGIN;
CREATE TYPE "GenerationStatus_new" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TABLE "RoadmapGeneration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RoadmapGeneration" ALTER COLUMN "status" TYPE "GenerationStatus_new"
  USING (CASE "status" WHEN 'GENERATING' THEN 'PROCESSING'::"GenerationStatus_new" ELSE "status"::text::"GenerationStatus_new" END);
DROP TYPE "GenerationStatus";
ALTER TYPE "GenerationStatus_new" RENAME TO "GenerationStatus";
ALTER TABLE "RoadmapGeneration" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterTable: job bookkeeping + self-contained input snapshot fields.
ALTER TABLE "RoadmapGeneration"
  ADD COLUMN "goal" TEXT,
  ADD COLUMN "level" "RoadmapLevel",
  ADD COLUMN "durationWeeks" INTEGER,
  ADD COLUMN "hoursPerWeek" INTEGER,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "qstashMessageId" TEXT;
