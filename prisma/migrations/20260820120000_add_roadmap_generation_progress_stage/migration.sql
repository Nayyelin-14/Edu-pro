-- Honest progress for the generating screen. Only real backend transitions are
-- written by the worker / inline dev path — never fake timers or percentages.
ALTER TABLE "RoadmapGeneration" ADD COLUMN "progressStage" TEXT;