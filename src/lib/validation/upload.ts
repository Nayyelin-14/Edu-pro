import { z } from "zod";

/**
 * Direct-upload signing request (spec §13).
 *
 * Two forms:
 *   - { lessonId }        -> attach media to an EXISTING lesson
 *   - { moduleId, title } -> create the lesson atomically with its first
 *                            media upload (the only sanctioned way a VIDEO
 *                            lesson can exist with a null videoUrl, and only
 *                            while its Asset is UPLOADING/PROCESSING)
 */
export const signUploadSchema = z
  .object({
    lessonId: z.string().min(1).optional(),
    moduleId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(160).optional(),
    kind: z.enum(["VIDEO", "PDF"]),
    /** Display-only original filename; sanitized server-side. */
    filename: z.string().max(255).optional(),
  })
  .refine((v) => !!v.lessonId || (!!v.moduleId && !!v.title), {
    message: "Provide lessonId, or moduleId together with title",
    path: ["lessonId"],
  });

export type SignUploadInput = z.infer<typeof signUploadSchema>;
