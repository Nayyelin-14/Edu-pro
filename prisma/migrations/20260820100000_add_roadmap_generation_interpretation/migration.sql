-- Persist the goal interpretation captured at request time (call #1) on the
-- generation job so the worker reuses it and never re-interprets.
ALTER TABLE "RoadmapGeneration" ADD COLUMN "interpretation" JSONB;