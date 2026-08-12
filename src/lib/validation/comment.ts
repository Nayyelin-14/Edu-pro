import { z } from "zod";

export const createCommentSchema = z.object({
  lessonId: z.string().min(1),
  content: z.string().trim().min(1, "Comment is empty").max(2000),
  parentId: z.string().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment is empty").max(2000),
});

export const createReviewSchema = z.object({
  courseId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().max(2000).optional(),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  content: z.string().trim().max(2000).nullable().optional(),
});
