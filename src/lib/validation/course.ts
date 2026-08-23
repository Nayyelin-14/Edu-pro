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

const skillToken = z.string().trim().min(1).max(60);

export const courseMetadataSchema = z.object({
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  estimatedHours: z.number().int().min(0).max(10_000).nullable().optional(),
  skills: z.array(skillToken).max(50).optional(),
  prerequisites: z.array(skillToken).max(50).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend(courseMetadataSchema.shape);

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

// ---------------------------------------------------------------------------
// Lesson content model.
//
// Exactly TWO persisted types (VIDEO | READING); READING carries exactly ONE
// source (rich-text article OR PDF). These discriminated unions are the first
// enforcement layer; admin.course.service re-checks every rule (server is
// authoritative), and DB CHECK constraints enforce exclusivity.
//
// Update semantics: content fields are ATOMIC. A PATCH must send the complete
// desired content payload for the lesson's type — partial content merges are
// rejected by design so conflicting combinations can never arise.
// ---------------------------------------------------------------------------

/** Public-facing media references must be proper https URLs. */
const httpsUrl = z
  .url({ protocol: /^https$/, hostname: /.*/ })
  .max(2048);

function readingRefine(
  val: { article?: string | null; pdfUrl?: string | null },
  ctx: z.RefinementCtx,
) {
  const hasArticle = typeof val.article === "string" && val.article.trim().length > 0;
  const hasPdf = typeof val.pdfUrl === "string" && val.pdfUrl.length > 0;
  if (hasArticle && hasPdf) {
    ctx.addIssue({
      code: "custom",
      message: "A READING lesson cannot have both article and pdfUrl",
      path: ["pdfUrl"],
    });
  } else if (!hasArticle && !hasPdf) {
    ctx.addIssue({
      code: "custom",
      message: "A READING lesson needs exactly one content source: article or pdfUrl",
      path: ["article"],
    });
  }
}

export const createLessonSchema = z.discriminatedUnion("type", [
  z.object({
    moduleId: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    type: z.literal("VIDEO"),
    // Required at creation: a VIDEO lesson is born with its video (either an
    // uploaded asset already verified, or a legacy external https URL).
    videoUrl: httpsUrl,
    videoDuration: z.number().int().min(0).max(86_400).optional(),
    article: z.null().optional(),
    pdfUrl: z.null().optional(),
    position: z.number().int().min(0).optional(),
    isFree: z.boolean().default(false),
  }),
  z
    .object({
      moduleId: z.string().min(1),
      title: z.string().trim().min(1).max(160),
      type: z.literal("READING"),
      videoUrl: z.null().optional(),
      videoDuration: z.number().int().min(0).max(86_400).optional(),
      article: z.string().max(50_000).nullable().optional(),
      pdfUrl: httpsUrl.nullable().optional(),
      position: z.number().int().min(0).optional(),
      isFree: z.boolean().default(false),
    })
    .superRefine(readingRefine),
]);

export const updateLessonSchema = z.discriminatedUnion("type", [
  z.object({
    title: z.string().trim().min(1).max(160).optional(),
    type: z.literal("VIDEO"),
    videoUrl: httpsUrl,
    videoDuration: z.number().int().min(0).max(86_400).optional(),
    article: z.null().optional(),
    pdfUrl: z.null().optional(),
    position: z.number().int().min(0).optional(),
    isFree: z.boolean().optional(),
  }),
  z
    .object({
      title: z.string().trim().min(1).max(160).optional(),
      type: z.literal("READING"),
      videoUrl: z.null().optional(),
      videoDuration: z.number().int().min(0).max(86_400).optional(),
      article: z.string().max(50_000).nullable().optional(),
      pdfUrl: httpsUrl.nullable().optional(),
      position: z.number().int().min(0).optional(),
      isFree: z.boolean().optional(),
    })
    .superRefine(readingRefine),
]);

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export const createQuizSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  questions: z.array(questionSchema).max(50).optional(),
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
