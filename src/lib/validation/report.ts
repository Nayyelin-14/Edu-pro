import { z } from "zod";

export const createReportSchema = z.object({
  courseId: z.string().min(1),
  reason: z.string().trim().min(1).max(120),
  details: z.string().trim().max(3000).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});
