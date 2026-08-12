import { z } from "zod";

const PUBLIC_USER_ROLES = ["SUBSCRIBER", "INVESTOR"] as const;

function normalizePublicUserRole(value: unknown) {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "PERFORMANCE_PARTNER" || normalized === "PARTNER") return "INVESTOR";
  return normalized;
}

const publicUserRoleSchema = z.preprocess(normalizePublicUserRole, z.enum(PUBLIC_USER_ROLES));

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
  role: publicUserRoleSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
