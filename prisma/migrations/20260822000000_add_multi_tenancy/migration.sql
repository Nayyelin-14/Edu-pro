-- AddMultiTenancy — approved A1 architecture applied to corrected baseline.
-- tenantId added nullable -> deterministic backfill from authoritative parents ->
-- zero-NULL guard -> NOT NULL -> indexes/constraints. SUPERADMINs get no membership.

-- ========== 1. Tenant infrastructure ==========
CREATE TYPE "TenantRole" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'STUDENT',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "TenantMembership_userId_tenantId_key" ON "TenantMembership"("userId", "tenantId");
CREATE INDEX "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");

-- ========== 2. tenantId columns (nullable first) ==========
ALTER TABLE "Certificate" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "CompletedLesson" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Course" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Module" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "QuizResult" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Report" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Review" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Roadmap" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "RoadmapGeneration" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "RoadmapItem" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Test" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "TestResult" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "WishlistItem" ADD COLUMN     "tenantId" TEXT;

-- ========== 3. Deterministic backfill ==========
INSERT INTO "Tenant" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt") VALUES ('tenant_default', 'Default Tenant', 'default', 'Auto-created tenant for pre-existing data', true, NOW(), NOW()) ON CONFLICT ("slug") DO NOTHING;
INSERT INTO "TenantMembership" ("id", "userId", "tenantId", "role", "joinedAt") SELECT 'tm_' || u."id", u."id", 'tenant_default', 'STUDENT', NOW() FROM "User" u WHERE u."role" <> 'SUPERADMIN' ON CONFLICT ("userId", "tenantId") DO NOTHING;
UPDATE "Course"          SET "tenantId" = 'tenant_default';
UPDATE "Module" m        SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE m."courseId"   = c."id";
UPDATE "Lesson" l        SET "tenantId" = m."tenantId"  FROM "Module" m              WHERE l."moduleId"   = m."id";
UPDATE "Enrollment" e    SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE e."courseId"   = c."id";
UPDATE "CompletedLesson" cl SET "tenantId" = m."tenantId" FROM "Lesson" l JOIN "Module" m ON l."moduleId" = m."id" WHERE cl."lessonId" = l."id";
UPDATE "Quiz" q          SET "tenantId" = m."tenantId"  FROM "Module" m              WHERE q."moduleId"   = m."id";
UPDATE "QuizResult" qr   SET "tenantId" = m."tenantId"  FROM "Quiz" q JOIN "Module" m ON q."moduleId" = m."id" WHERE qr."quizId" = q."id";
UPDATE "Test" t          SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE t."courseId"   = c."id";
UPDATE "TestResult" tr   SET "tenantId" = t."tenantId"  FROM "Test" t JOIN "Course" c ON t."courseId" = c."id" WHERE tr."testId" = t."id";
UPDATE "Certificate" ce  SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE ce."courseId"  = c."id";
UPDATE "Review" r        SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE r."courseId"   = c."id";
UPDATE "WishlistItem" w  SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE w."courseId"   = c."id";
UPDATE "Report" rp       SET "tenantId" = c."tenantId"  FROM "Course" c              WHERE rp."courseId"  = c."id";
UPDATE "Roadmap" rm      SET "tenantId" = 'tenant_default';
UPDATE "RoadmapItem" ri  SET "tenantId" = rm."tenantId" FROM "Roadmap" rm            WHERE ri."roadmapId" = rm."id";
UPDATE "RoadmapGeneration" rg SET "tenantId" = 'tenant_default';

-- ========== 4. Zero-NULL guard (fails migration if any NULL remains) ==========
DO $$
DECLARE
  null_count INTEGER;
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['Certificate','CompletedLesson','Course','Enrollment','Lesson','Module','Quiz','QuizResult','Report','Review','Roadmap','RoadmapGeneration','RoadmapItem','Test','TestResult','WishlistItem'])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "tenantId" IS NULL', tbl) INTO null_count;
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Backfill incomplete: % has % NULL tenantId rows — aborting before NOT NULL', tbl, null_count;
    END IF;
  END LOOP;
END $$;

-- ========== 5. Enforce NOT NULL ==========
ALTER TABLE "Certificate" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CompletedLesson" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Course" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Enrollment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Module" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Quiz" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "QuizResult" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Roadmap" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RoadmapGeneration" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RoadmapItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Test" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TestResult" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "WishlistItem" ALTER COLUMN "tenantId" SET NOT NULL;

-- ========== 6. Approved unique constraint changes ==========
DROP INDEX "Certificate_userId_courseId_key";
DROP INDEX "Enrollment_userId_courseId_key";
DROP INDEX "QuizResult_quizId_userId_key";
DROP INDEX "Review_userId_courseId_key";
DROP INDEX "WishlistItem_userId_courseId_key";
CREATE INDEX "Certificate_tenantId_idx" ON "Certificate"("tenantId");
CREATE UNIQUE INDEX "Certificate_userId_courseId_tenantId_key" ON "Certificate"("userId", "courseId", "tenantId");
CREATE INDEX "CompletedLesson_tenantId_idx" ON "CompletedLesson"("tenantId");
CREATE INDEX "Course_tenantId_idx" ON "Course"("tenantId");
CREATE INDEX "Enrollment_tenantId_idx" ON "Enrollment"("tenantId");
CREATE UNIQUE INDEX "Enrollment_userId_courseId_tenantId_key" ON "Enrollment"("userId", "courseId", "tenantId");
CREATE INDEX "Lesson_tenantId_idx" ON "Lesson"("tenantId");
CREATE INDEX "Module_tenantId_idx" ON "Module"("tenantId");
CREATE INDEX "Quiz_tenantId_idx" ON "Quiz"("tenantId");
CREATE INDEX "QuizResult_tenantId_idx" ON "QuizResult"("tenantId");
CREATE UNIQUE INDEX "QuizResult_quizId_userId_tenantId_key" ON "QuizResult"("quizId", "userId", "tenantId");
CREATE INDEX "Report_tenantId_idx" ON "Report"("tenantId");
CREATE INDEX "Review_tenantId_idx" ON "Review"("tenantId");
CREATE UNIQUE INDEX "Review_userId_courseId_tenantId_key" ON "Review"("userId", "courseId", "tenantId");
CREATE INDEX "Roadmap_tenantId_idx" ON "Roadmap"("tenantId");
CREATE INDEX "RoadmapGeneration_tenantId_idx" ON "RoadmapGeneration"("tenantId");
CREATE INDEX "RoadmapItem_tenantId_idx" ON "RoadmapItem"("tenantId");
CREATE INDEX "Test_tenantId_idx" ON "Test"("tenantId");
CREATE INDEX "TestResult_tenantId_idx" ON "TestResult"("tenantId");
CREATE INDEX "WishlistItem_tenantId_idx" ON "WishlistItem"("tenantId");
CREATE UNIQUE INDEX "WishlistItem_userId_courseId_tenantId_key" ON "WishlistItem"("userId", "courseId", "tenantId");
