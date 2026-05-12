import { z } from "zod";

// ---------------------------------------------------------------------------
// Internal helper — same contract as packages/utils/src/env.ts.
// The canonical implementation lives there (tested separately).
// CJS build boundary prevents importing it here directly.
// ---------------------------------------------------------------------------

interface SchemaThatCanParse<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: z.ZodError };
}

function parseEnv<T>(
  schema: SchemaThatCanParse<T>,
  source: Record<string, string | undefined> = process.env,
): T {
  const result = schema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`Environment validation failed:\n${issues}`);

  throw new Error("Environment validation failed — check the log above for details");
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis (BullMQ)
    REDIS_URL: z.string().url().optional(),

    // App URLs
    STOREFRONT_URL: z.string().url().optional(),
    ADMIN_URL: z.string().url().optional(),

    // Auth
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("30d"),
    CSRF_SECRET: z.string().min(32),

    // Stripe
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),

    // Observability
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    SENTRY_USER_ID_PEPPER: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // STOREFRONT_URL — required in production
    if (val.NODE_ENV === "production" && !val.STOREFRONT_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STOREFRONT_URL"],
        message: "Required in production",
      });
    }

    // ADMIN_URL — required in production
    if (val.NODE_ENV === "production" && !val.ADMIN_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ADMIN_URL"],
        message: "Required in production",
      });
    }

    // STRIPE_SECRET_KEY — required in production
    if (val.NODE_ENV === "production" && !val.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_SECRET_KEY"],
        message: "Required in production",
      });
    }

    // STRIPE_WEBHOOK_SECRET — required whenever STRIPE_SECRET_KEY is set
    if (val.STRIPE_SECRET_KEY && !val.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_WEBHOOK_SECRET"],
        message: "Required when STRIPE_SECRET_KEY is set",
      });
    }
  });

export type Env = z.infer<typeof apiEnvSchema>;

/**
 * Pure factory — validates an arbitrary input record against the API schema.
 * Use in tests to construct a typed env without touching process.env.
 */
export function createEnv(input: Record<string, string | undefined>): Env {
  return parseEnv(apiEnvSchema, input);
}

/**
 * Module-level singleton — parsed once at import time.
 * The process crashes here if any required variable is missing or malformed.
 */
export const env: Env = parseEnv(apiEnvSchema);
