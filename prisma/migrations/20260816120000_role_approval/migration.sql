-- Role-based access control: instructor-owned courses with an approval workflow.
-- Only APPROVED courses are published (isPublished = true is kept in sync).

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "instructorId" TEXT;

-- Backfill: previously published courses are treated as approved.
UPDATE "Course" SET "approvalStatus" = 'APPROVED' WHERE "isPublished" = true;

-- CreateIndex
CREATE INDEX "Course_instructorId_idx" ON "Course"("instructorId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;