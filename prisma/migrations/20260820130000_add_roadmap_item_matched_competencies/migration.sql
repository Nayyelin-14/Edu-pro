-- Server retrieval evidence for the "Why this course?" block in the result UI.
-- Competencies the course demonstrably covers for this path (never from the AI).
ALTER TABLE "RoadmapItem" ADD COLUMN "matched_competencies" JSONB;