import type { Locale } from "@/lib/i18n";
import { pagesSegment } from "./segments";

/**
 * Editorial "story/landing" pages for top-level product categories. Each key
 * maps to exactly one canonical category slug (see categoryStoryCanonicalSlug)
 * so the header can route a category name to its story page instead of the
 * plain product grid.
 */
export const categoryStoryPageKeys = [
  "categoryNuts",
  "categoryDriedFruit",
  "categoryMuesliGrains",
  "categorySnacks",
  "categoryHoney",
  "categoryNutButter",
] as const;

export type CategoryStoryPageKey = (typeof categoryStoryPageKeys)[number];

export const pageKeys = [
  "about",
  "contact",
  "faq",
  "shippingReturns",
  "markets",
  "terms",
  "additionalTerms",
  "privacy",
  "cookies",
  "withdrawal",
  "processingAgreement",
  "subscribe",
  "optOut",
  ...categoryStoryPageKeys,
] as const;

export type PageKey = (typeof pageKeys)[number];

/** The canonical (DB) category slug each category story page is about. */
export const categoryStoryCanonicalSlug: Record<CategoryStoryPageKey, string> = {
  categoryNuts: "noten",
  categoryDriedFruit: "gedroogd-fruit",
  categoryMuesliGrains: "muesli-granen",
  categorySnacks: "snacks-zoutjes",
  categoryHoney: "honing",
  categoryNutButter: "notenpasta-s",
};

/** Reverse lookup: canonical category slug -> its story page key, if any. */
export const categoryStoryPageKeyByCanonicalSlug: Partial<Record<string, CategoryStoryPageKey>> =
  Object.fromEntries(
    categoryStoryPageKeys.map((key) => [categoryStoryCanonicalSlug[key], key])
  );

export function isCategoryStoryPageKey(key: PageKey): key is CategoryStoryPageKey {
  return (categoryStoryPageKeys as readonly PageKey[]).includes(key);
}

export const indexablePageKeys = pageKeys.filter(
  (key): key is Exclude<PageKey, "subscribe" | "optOut" | "processingAgreement"> =>
    key !== "subscribe" && key !== "optOut" && key !== "processingAgreement"
);

export function pageRobots(key: PageKey): { index: false; follow: true } | undefined {
  return key === "subscribe" || key === "optOut" || key === "processingAgreement"
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
  additionalTerms: {
    nl: "aanvullende-voorwaarden",
    en: "additional-terms",
    fr: "conditions-complementaires",
  },
  privacy: { nl: "privacybeleid", en: "privacy-policy", fr: "politique-de-confidentialite" },
  cookies: { nl: "cookiebeleid", en: "cookie-policy", fr: "politique-de-cookies" },
  withdrawal: { nl: "herroepingsrecht", en: "right-of-withdrawal", fr: "droit-de-retractation" },
  processingAgreement: {
    nl: "verwerkersovereenkomst",
    en: "data-processing-agreement",
    fr: "accord-de-traitement-des-donnees",
  },
  subscribe: { nl: "aanmelden-nieuwsbrief", en: "newsletter-signup", fr: "inscription-newsletter" },
  optOut: { nl: "afmelden-nieuwsbrief", en: "newsletter-opt-out", fr: "desinscription-newsletter" },
  categoryNuts: { nl: "noten", en: "nuts", fr: "noix" },
  categoryDriedFruit: { nl: "gedroogd-fruit", en: "dried-fruit", fr: "fruits-secs" },
  categoryMuesliGrains: { nl: "muesli-granen", en: "muesli-and-grains", fr: "muesli-et-cereales" },
  categorySnacks: { nl: "snacks-zoutjes", en: "snacks-and-savouries", fr: "snacks-et-sales" },
  categoryHoney: { nl: "honing", en: "honey", fr: "miel" },
  categoryNutButter: { nl: "notenpasta-s", en: "nut-butter", fr: "beurre-de-noix" },
};

export function pagePath(key: PageKey, locale: Locale): string {
  return `/${locale}/${pagesSegment[locale]}/${pageSlugs[key][locale]}`;
}

export function resolvePageKey(locale: Locale, slug: string): PageKey | undefined {
  return pageKeys.find((key) => pageSlugs[key][locale] === slug);
}
