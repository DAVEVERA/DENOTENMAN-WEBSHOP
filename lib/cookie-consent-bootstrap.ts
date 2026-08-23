import {
  COOKIE_CONSENT_KNOWN_ATTRIBUTE,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
} from "@/lib/cookie-consent";

export const COOKIE_CONSENT_BOOTSTRAP_SCRIPT = String.raw`
  (() => {
    try {
      const value = window.localStorage.getItem(${JSON.stringify(COOKIE_CONSENT_STORAGE_KEY)});
      if (!value) return;
      const consent = JSON.parse(value);
      const expiresAt = Date.parse(consent?.expiresAt);
      if (
        consent?.version === ${COOKIE_CONSENT_VERSION} &&
        consent?.necessary === true &&
        typeof consent?.analytics === "boolean" &&
        typeof consent?.marketing === "boolean" &&
        Number.isFinite(expiresAt) &&
        expiresAt > Date.now()
      ) {
        document.documentElement.setAttribute(${JSON.stringify(COOKIE_CONSENT_KNOWN_ATTRIBUTE)}, "true");
      }
    } catch {}
  })();
`;
