import type { ZodError } from "zod";

interface SchemaThatCanParse<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: ZodError };
}

/**
 * Parses and validates a plain record against the given Zod schema.
 *
 * On success returns the typed, validated object.
 * On failure logs each issue (key + message, never the value) and throws.
 * Never calls process.exit — callers let the exception propagate so Node
 * prints the stack and the process exits with a non-zero code.
 */
export function parseEnv<T>(
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
