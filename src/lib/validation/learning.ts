import { z } from "zod";

export const answerInputSchema = z.object({
  questionId: z.string().min(1),
  // -1 is the sentinel for "unanswered" (the UI allows submitting with
  // unanswered questions); the grading service treats any selected < 0 as
  // incorrect. Rejecting -1 here broke test submission entirely.
  selected: z.number().int().min(-1),
});

export const submitQuizSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
});

export const submitTestSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
  startedAt: z.string().datetime().optional(),
});
