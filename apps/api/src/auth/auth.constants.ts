// Token TTLs in seconds
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Cookie names (ADR 0009)
export const COOKIE_REFRESH_TOKEN = "refresh_token";
export const COOKIE_CSRF_TOKEN = "csrf-token";
export const COOKIE_CSRF_SECRET = "csrf-secret";

// Metadata keys
export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "roles";

// Audit event names
export const AUDIT_REFRESH_REUSE = "auth.refresh.reuse_detected";

// Routes that bypass CSRF (must match exactly, including version prefix)
export const CSRF_EXEMPT_ROUTES = ["/v1/stripe/webhook"] as const;
