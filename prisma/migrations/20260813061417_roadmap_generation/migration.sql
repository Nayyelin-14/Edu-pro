-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "RoadmapGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'GENERATING',
    "roadmapId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapGeneration_userId_idx" ON "RoadmapGeneration"("userId");

-- CreateIndex
CREATE INDEX "RoadmapGeneration_status_idx" ON "RoadmapGeneration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapGeneration_userId_fingerprint_key" ON "RoadmapGeneration"("userId", "fingerprint");

-- AddForeignKey
ALTER TABLE "RoadmapGeneration" ADD CONSTRAINT "RoadmapGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
