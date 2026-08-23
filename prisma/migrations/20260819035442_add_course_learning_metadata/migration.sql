-- CreateEnum
CREATE TYPE "CourseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "difficulty" "CourseDifficulty" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "prerequisites" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "skills" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "RoadmapItem" ADD COLUMN     "milestones" JSONB NOT NULL DEFAULT '[]';
