const EMBEDDED_SECRET_PATTERNS = [
  /\bsk-(?:proj-|svcacct-)?[a-z0-9_-]{16,}\b/i,
  /\bOPENAI_API_KEY\s*=\s*["'][^"'\r\n]{12,}["']/i,
  /\b(?:API_KEY|OPENAI_KEY|OPENAI_TOKEN)\s*=\s*["'][^"'\r\n]{12,}["']/i,
] as const;

export function assertNoEmbeddedScriptSecrets(content: string): void {
  if (EMBEDDED_SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new Error("APEX_SCRIPT_CONTAINS_EMBEDDED_SECRET");
  }
}
