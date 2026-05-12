/** Cookie name for the guest cart token (HttpOnly, Secure, SameSite=Lax). */
export const CART_COOKIE_NAME = "cart_token" as const;

/** Guest cart cookie TTL in seconds — 30 days. */
export const CART_COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Cart expiry TTL in milliseconds — 30 days. */
export const CART_EXPIRY_MS = CART_COOKIE_TTL_SECONDS * 1000;
