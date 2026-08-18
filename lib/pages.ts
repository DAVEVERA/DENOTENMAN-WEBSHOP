import type { Locale } from "@/lib/i18n";
import { pagesSegment } from "./segments";

export const pageKeys = [
  "about",
  "contact",
  "faq",
  "shippingReturns",
  "markets",
  "terms",
  "privacy",
  "cookies",
  "withdrawal",
  "subscribe",
  "optOut",
] as const;

export type PageKey = (typeof pageKeys)[number];

export const indexablePageKeys = pageKeys.filter(
  (key): key is Exclude<PageKey, "subscribe" | "optOut"> =>
    key !== "subscribe" && key !== "optOut"
);

export function pageRobots(
  key: PageKey
): { index: false; follow: true } | undefined {
  return key === "subscribe" || key === "optOut"
    ? { index: false, follow: true }
    : undefined;
}

export const pageSlugs: Record<PageKey, Record<Locale, string>> = {
  about: { nl: "over-ons", en: "about-us", fr: "a-propos" },
  contact: { nl: "contact", en: "contact", fr: "contact" },
  faq: { nl: "veelgestelde-vragen", en: "faq", fr: "faq" },
  shippingReturns: {
    nl: "verzenden-en-retourneren",
    en: "shipping-and-returns",
    fr: "livraison-et-retours",
  },
  markets: { nl: "markten", en: "markets", fr: "marches" },
  terms: {
    nl: "algemene-voorwaarden",
    en: "terms-and-conditions",
    fr: "conditions-generales",
  },
  privacy: { nl: "privacybeleid", en: "privacy-policy", fr: "politique-de-confidentialite" },
  cookies: { nl: "cookiebeleid", en: "cookie-policy", fr: "politique-de-cookies" },
  withdrawal: { nl: "herroepingsrecht", en: "right-of-withdrawal", fr: "droit-de-retractation" },
  subscribe: { nl: "aanmelden-nieuwsbrief", en: "newsletter-signup", fr: "inscription-newsletter" },
  optOut: { nl: "afmelden-nieuwsbrief", en: "newsletter-opt-out", fr: "desinscription-newsletter" },
};

export function pagePath(key: PageKey, locale: Locale): string {
  return `/${locale}/${pagesSegment[locale]}/${pageSlugs[key][locale]}`;
}

export function resolvePageKey(locale: Locale, slug: string): PageKey | undefined {
  return pageKeys.find((key) => pageSlugs[key][locale] === slug);
}
