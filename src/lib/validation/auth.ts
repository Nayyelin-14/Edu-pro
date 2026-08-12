import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "At least 3 characters")
  .max(30, "At most 30 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only");

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters");

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional().default(true),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const verifyOtpSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6, "Enter the 6-digit code"),
});

export const initEnableTwoStepSchema = z.object({
  method: z.enum(["EMAIL", "GOOGLE_AUTH"]),
});

export const confirmEnableTwoStepSchema = z.object({
  method: z.enum(["EMAIL", "GOOGLE_AUTH"]),
  code: z.string().min(6).max(8),
  // For GOOGLE_AUTH: the secret returned by the init step.
  totpSecret: z.string().length(32).optional(),
});

export const disableTwoStepSchema = z.object({
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
