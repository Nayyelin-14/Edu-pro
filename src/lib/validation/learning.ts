import { z } from "zod";

export const answerInputSchema = z.object({
  questionId: z.string().min(1),
  selected: z.number().int().min(0),
});

export const submitQuizSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
});

export const submitTestSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
  startedAt: z.string().datetime().optional(),
});
