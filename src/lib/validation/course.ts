import { z } from "zod";

export const questionSchema = z
  .object({
    id: z.string().optional(),
    question: z.string().trim().min(1).max(500),
    options: z.array(z.string().trim().min(1)).min(2).max(6),
    correctIndex: z.number().int().min(0),
  })
  .transform((q) => ({ ...q, id: q.id ?? "" }));

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens");

export const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: slugSchema,
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().max(50_000).optional(),
  coverImage: z.string().trim().optional(),
  price: z.number().int().min(0).max(10_000_000).default(0),
  categoryId: z.string().optional().nullable(),
  isFeatured: z.boolean().default(false),
});

export const updateCourseSchema = createCourseSchema.partial();

export const createModuleSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateModuleSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const createLessonSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  videoUrl: z.string().trim().optional(),
  videoDuration: z.number().int().min(0).optional(),
  article: z.string().max(50_000).optional(),
  position: z.number().int().min(0).optional(),
  isFree: z.boolean().default(false),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  videoUrl: z.string().trim().nullable().optional(),
  videoDuration: z.number().int().min(0).optional(),
  article: z.string().max(50_000).nullable().optional(),
  position: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
});

export const createQuizSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  questions: z.array(questionSchema).min(1).max(50),
});

export const updateQuizSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  questions: z.array(questionSchema).min(1).max(50).optional(),
});

export const createTestSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  passingScore: z.number().int().min(1).max(100).default(60),
  timeLimitMinutes: z.number().int().min(1).max(600).default(30),
  attemptLimit: z.number().int().min(1).max(20).default(3),
  isEnabled: z.boolean().default(true),
  questions: z.array(questionSchema).min(1).max(100),
});

export const updateTestSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  passingScore: z.number().int().min(1).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional(),
  attemptLimit: z.number().int().min(1).max(20).optional(),
  isEnabled: z.boolean().optional(),
  questions: z.array(questionSchema).min(1).max(100).optional(),
});
