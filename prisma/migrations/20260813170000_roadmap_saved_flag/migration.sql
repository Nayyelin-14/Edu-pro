-- AlterTable: roadmap drafts are persisted at generation time but not "saved"
-- until the user reviews and confirms. Only saved roadmaps appear in lists.
ALTER TABLE "Roadmap"
  ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "savedAt" TIMESTAMP(3);