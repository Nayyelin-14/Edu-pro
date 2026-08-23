/*
  Warnings:

  - Added the required column `type` to the `Lesson` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('VIDEO', 'PDF');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('VIDEO', 'READING');

-- AlterTable
-- `type` is added NULLable first, backfilled deterministically below (see the
-- end of this migration, after all DDL), then constrained NOT NULL.
ALTER TABLE "Lesson" ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "type" "LessonType";

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lessonId" TEXT,
    "courseId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "publicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "format" TEXT,
    "filename" TEXT,
    "bytes" BIGINT,
    "duration" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonContentArchive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lessonTitle" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "videoUrl" TEXT,
    "article" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonContentArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_publicId_key" ON "Asset"("publicId");

-- CreateIndex
CREATE INDEX "Asset_lessonId_kind_idx" ON "Asset"("lessonId", "kind");

-- CreateIndex
CREATE INDEX "Asset_tenantId_idx" ON "Asset"("tenantId");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "LessonContentArchive_lessonId_idx" ON "LessonContentArchive"("lessonId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Legacy data migration (spec §2). Deterministic, non-destructive:
--   video only      -> VIDEO
--   article only    -> READING
--   video + article -> original content copied to LessonContentArchive
--                      ("VIDEO_AND_ARTICLE"), then VIDEO, article cleared.
--   neither         -> preserved; archived as INCOMPLETE; type = READING.
--                      Future writes cannot recreate this state (enforced at
--                      the Zod + service layers).
-- ---------------------------------------------------------------------------
CREATE TABLE "LessonContentArchive_migration" AS
SELECT gen_random_uuid()::text AS "id", "tenantId", "id" AS "lessonId", "title" AS "lessonTitle",
       CASE WHEN "videoUrl" IS NOT NULL AND "article" IS NOT NULL THEN 'VIDEO_AND_ARTICLE' ELSE 'INCOMPLETE' END AS "reason",
       "videoUrl", "article", CURRENT_TIMESTAMP AS "archivedAt"
FROM "Lesson"
WHERE ("videoUrl" IS NOT NULL AND "article" IS NOT NULL)
   OR ("videoUrl" IS NULL AND "article" IS NULL);

INSERT INTO "LessonContentArchive" ("id", "tenantId", "lessonId", "lessonTitle", "reason", "videoUrl", "article", "archivedAt")
SELECT * FROM "LessonContentArchive_migration";

DROP TABLE "LessonContentArchive_migration";

UPDATE "Lesson" SET "type" = 'VIDEO', "article" = NULL WHERE "videoUrl" IS NOT NULL;
UPDATE "Lesson" SET "type" = 'READING' WHERE "videoUrl" IS NULL;

ALTER TABLE "Lesson" ALTER COLUMN "type" SET NOT NULL;
-- ---------------------------------------------------------------------------
