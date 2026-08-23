-- Add updatedAt used by media lifecycle/cleanup cutoffs.
ALTER TABLE "Lesson" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
