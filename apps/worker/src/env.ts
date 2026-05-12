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

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKER_PORT: z.coerce.number().int().positive().default(3002),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis — always required for the worker (BullMQ queues)
  REDIS_URL: z.string().url(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/**
 * Pure factory — validates an arbitrary input record against the worker schema.
 * Use in tests to construct a typed env without touching process.env.
 */
export function createWorkerEnv(input: Record<string, string | undefined>): WorkerEnv {
  return parseEnv(workerEnvSchema, input);
}

/**
 * Module-level singleton — parsed once at import time.
 * The process crashes here if any required variable is missing or malformed.
 */
export const env: WorkerEnv = parseEnv(workerEnvSchema);
