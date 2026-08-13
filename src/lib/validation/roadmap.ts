import { z } from "zod";

export const RoadmapLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export type RoadmapLevel = z.infer<typeof RoadmapLevelSchema>;

export const generateRoadmapSchema = z.object({
  goal: z.string().trim().min(5, "Please describe at least 5 characters").max(500, "Goal is too long"),
  level: RoadmapLevelSchema,
  durationWeeks: z.number().int().min(1, "At least 1 week").max(52, "At most 52 weeks"),
  hoursPerWeek: z.number().int().min(1, "At least 1 hour").max(40, "At most 40 hours"),
  language: z.enum(["en", "th"]).optional().default("en"),
});
export type GenerateRoadmapInput = z.infer<typeof generateRoadmapSchema>;

/** The strict schema for raw AI output BEFORE course resolution. Stages
 * reference candidates by their opaque `courseKey` (never by title text); the
 * server resolves the key to a real course row. */
export const aiRoadmapPlanSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(2000),
  stages: z
    .array(
      z.object({
        stageNumber: z.number().int().min(1),
        title: z.string().min(1).max(120),
        description: z.string().max(1000).nullable().optional(),
        goal: z.string().max(300).nullable().optional(),
        weekStart: z.number().int().min(1),
        weekEnd: z.number().int().min(1),
        courseKey: z.string().max(64).nullable(),
        reason: z.string().max(800).nullable().optional(),
        isTopic: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(8),
});

export type AIRoadmapPlanRaw = z.infer<typeof aiRoadmapPlanSchema>;

/**
 * Post-parse, post-resolution normalization that persists to the DB.
 * `courseId` is null only when the stage is a suggested topic (the server
 * resolved the title and found no matching published course).
 */
export const normalizedStageSchema = z.object({
  stageNumber: z.number().int().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  goal: z.string().max(300).nullable(),
  weekStart: z.number().int().min(1),
  weekEnd: z.number().int().min(1),
  courseId: z.string().nullable(),
  courseTitle: z.string().nullable(),
  courseReason: z.string().nullable(),
  isTopic: z.boolean(),
});
