import { z } from "zod";
import { IdSchema } from "./common.js";

export const UserRoleSchema = z.enum(["owner", "admin", "staff", "customer"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  role: UserRoleSchema,
  emailVerifiedAt: z.coerce.date().nullable(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type Login = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
export type Register = z.infer<typeof RegisterSchema>;

export const RefreshTokenSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  expiresAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
});
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
