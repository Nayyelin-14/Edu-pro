import { z } from "zod";
import { usernameSchema, passwordSchema } from "./auth";

export const createAdminSchema = z.object({
  inviteToken: z.string().min(1),
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  role: z.enum(["STUDENT", "ADMIN", "SUPERADMIN"]).optional(),
  isBanned: z.boolean().optional(),
});

export const issueCertificateSchema = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
});

export const usersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const coursesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["ALL", "PUBLISHED", "DRAFT"]).default("ALL"),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const reportsQuerySchema = z.object({
  status: z.enum(["ALL", "PENDING", "RESOLVED", "DISMISSED"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
