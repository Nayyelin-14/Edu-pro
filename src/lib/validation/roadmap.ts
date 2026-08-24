import { z } from "zod";

export const RoadmapLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export type RoadmapLevel = z.infer<typeof RoadmapLevelSchema>;

/** One follow-up answer a learner gives to a clarification question. */
export const clarificationAnswerSchema = z.object({
  id: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(300),
});

export const clarificationAnswersSchema = z.array(clarificationAnswerSchema).max(3).optional();

export type ClarificationAnswerRaw = z.infer<typeof clarificationAnswerSchema>;

export const generateRoadmapSchema = z.object({
  goal: z.string().trim().min(5, "Tell us what you want to achieve (at least 5 characters)").max(500, "Goal is too long"),
  // Optional refinements — sensible backend defaults are chosen when absent so
  // the learner only ever has to type their goal.
  level: RoadmapLevelSchema.optional(),
  durationWeeks: z.number().int().min(1).max(52).optional(),
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
  language: z.enum(["en", "th"]).optional(),
  // Preferred model id from the /api/ai/models catalog (NIM). Falls back to the
  // configured default when absent or unknown.
  model: z.string().trim().min(1).max(160).optional(),
  // Force a brand-new generation instead of returning the idempotent result for
  // the same fingerprint (used by the "Regenerate" action).
  refresh: z.boolean().optional(),
  // Clarification answers from the NEEDS_CLARIFICATION response. When present,
  // they are merged into the goal interpretation before a job is created.
  answers: clarificationAnswersSchema,
});
export type GenerateRoadmapInput = z.infer<typeof generateRoadmapSchema>;

/** The strict schema for raw AI output BEFORE course resolution. Stages
 * reference candidates by their opaque `courseKey` (never by title text); the
 * server resolves the key to a real course row and rejects anything that does
 * not exist in the catalog. */
export const aiRoadmapStageSchema = z.object({
  stageNumber: z.number().int().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).nullable().optional(),
  goal: z.string().max(300).nullable().optional(),
  weekStart: z.number().int().min(1),
  weekEnd: z.number().int().min(1),
  courseKey: z.string().max(64).nullable(),
  reason: z.string().max(800).nullable().optional(),
  isTopic: z.boolean().default(false),
  skills: z.array(z.string().min(1).max(60)).max(20).optional(),
  milestones: z.array(z.string().min(1).max(200)).max(6).optional(),
});

export const aiRoadmapPlanSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(2000).optional(),
  stages: z.array(aiRoadmapStageSchema).min(1).max(8),
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
  skills: z.array(z.string()).max(20).optional(),
  prerequisites: z.array(z.string()).max(20).optional(),
  estimatedWeeks: z.number().int().min(0).optional(),
  milestones: z.array(z.string()).max(6).optional(),
  matchQuality: z.enum(["DIRECT", "STRONG", "RELATED", "WEAK"]).nullable().optional(),
});

export type NormalizedStage = z.infer<typeof normalizedStageSchema>;

/**
 * Strict schema for the AI's goal interpretation (call #1). The AI is free to
 * phrase the role/domain naturally, but skills/knownSkills/level/confidence
 * must survive validation; anything malformed falls back to the deterministic
 * analyzer so a bad interpretation never blocks roadmap generation.
 */
export const interpretationSchema = z.object({
  role: z.string().max(120).nullable().optional(),
  roleId: z.string().max(120).nullable().optional(),
  roleSource: z.enum(["profile", "general", "none"]).default("none"),
  roleConfidence: z.number().min(0).max(1),
  domain: z.string().max(60).nullable().optional(),
  domainConfidence: z.number().min(0).max(1),
  skills: z.array(z.string().min(1).max(60)).max(30),
  knownSkills: z.array(z.string().min(1).max(60)).max(30),
  level: RoadmapLevelSchema,
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string().min(1).max(200)).max(10),
  target: z.string().max(120).nullable().optional(),
  outcome: z.string().max(200).nullable().optional(),
  competencies: z.array(
    z.object({
      name: z.string().min(1).max(60),
      rationale: z.string().max(300).nullable().optional(),
      importance: z.enum(["critical", "important", "optional"]),
    })
  ).max(20).default([]),
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    gaps: z.array(z.string().max(60)).max(5),
    reason: z.string().max(200).nullable().optional(),
  }).default({ isAmbiguous: false, gaps: [], reason: null }),
});

export type InterpretationRaw = z.infer<typeof interpretationSchema>;