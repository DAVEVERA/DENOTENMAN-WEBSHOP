/**
 * Minimal env helper. Throws at startup when a required variable is missing.
 * EnvService (PR #5-A) will supersede this once available.
 */
export function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
