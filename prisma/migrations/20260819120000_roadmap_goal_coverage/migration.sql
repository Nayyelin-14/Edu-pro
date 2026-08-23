-- Deterministic goal interpretation + honest coverage (production redesign).

-- Roadmap: interpretation, confidence, assumptions, coverage quality metrics.
ALTER TABLE "Roadmap" ADD COLUMN "interpretation" JSONB;
ALTER TABLE "Roadmap" ADD COLUMN "goal_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Roadmap" ADD COLUMN "assumptions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Roadmap" ADD COLUMN "goal_coverage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Roadmap" ADD COLUMN "course_availability" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Roadmap" ADD COLUMN "coverage_breakdown" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Roadmap" ADD COLUMN "roadmap_quality" TEXT NOT NULL DEFAULT 'poor';

-- RoadmapItem: per-stage match quality for the matched course.
ALTER TABLE "RoadmapItem" ADD COLUMN "match_quality" TEXT;