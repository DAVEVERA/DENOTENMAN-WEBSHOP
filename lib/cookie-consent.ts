export const COOKIE_CONSENT_STORAGE_KEY = "denotenman-cookie-consent-v1";
export const COOKIE_CONSENT_EVENT = "denotenman-cookie-consent-change";
export const COOKIE_SETTINGS_EVENT = "denotenman-open-cookie-settings";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_LIFETIME_DAYS = 180;

export type CookieConsent = {
  version: typeof COOKIE_CONSENT_VERSION;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
  expiresAt: string;
};

export function createCookieConsent(
  preferences: Pick<CookieConsent, "analytics" | "marketing">,
  now = new Date()
): CookieConsent {
  const expiresAt = new Date(
    now.getTime() + COOKIE_CONSENT_LIFETIME_DAYS * 24 * 60 * 60 * 1000
  );

  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function parseCookieConsent(value: string | null, now = new Date()): CookieConsent | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<CookieConsent>;
    if (
      candidate.version !== COOKIE_CONSENT_VERSION ||
      candidate.necessary !== true ||
      typeof candidate.analytics !== "boolean" ||
      typeof candidate.marketing !== "boolean" ||
      typeof candidate.updatedAt !== "string" ||
      typeof candidate.expiresAt !== "string"
    ) {
      return null;
    }

    const expiresAt = Date.parse(candidate.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null;
    return candidate as CookieConsent;
  } catch {
    return null;
  }
}
