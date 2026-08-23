/*
  Warnings:

  - You are about to drop the column `attemptCount` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `durationMs` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `generatedAt` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `inputTokens` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `outputTokens` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `retryCount` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `savedAt` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `totalTokens` on the `Roadmap` table. All the data in the column will be lost.
  - You are about to drop the column `usageSource` on the `Roadmap` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CatalogCoverage" AS ENUM ('COMPLETE', 'PARTIAL', 'WEAK', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('DRAFT', 'SAVED', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "Roadmap" DROP COLUMN "attemptCount",
DROP COLUMN "durationMs",
DROP COLUMN "generatedAt",
DROP COLUMN "inputTokens",
DROP COLUMN "outputTokens",
DROP COLUMN "retryCount",
DROP COLUMN "savedAt",
DROP COLUMN "totalTokens",
DROP COLUMN "usageSource",
ADD COLUMN     "attempt_count" INTEGER,
ADD COLUMN     "catalog_coverage" "CatalogCoverage" NOT NULL DEFAULT 'UNAVAILABLE',
ADD COLUMN     "current_course_id" TEXT,
ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "input_tokens" INTEGER,
ADD COLUMN     "missing_skills" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "normalized_goal" JSONB,
ADD COLUMN     "output_tokens" INTEGER,
ADD COLUMN     "progress_percent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retry_count" INTEGER,
ADD COLUMN     "saved_at" TIMESTAMP(3),
ADD COLUMN     "shortExplanation" TEXT,
ADD COLUMN     "status" "RoadmapStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "total_tokens" INTEGER,
ADD COLUMN     "usage_source" "UsageSource";

-- AlterTable
ALTER TABLE "RoadmapItem" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "estimated_weeks" INTEGER,
ADD COLUMN     "isTopic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prerequisites" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "skills" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Roadmap_status_idx" ON "Roadmap"("status");

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_current_course_id_fkey" FOREIGN KEY ("current_course_id") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
