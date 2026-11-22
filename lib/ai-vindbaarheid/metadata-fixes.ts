import { toProductPlainText } from "@/lib/product-content";

export type MetadataFix = {
  locale: "nl" | "en" | "fr";
  field: "seoTitle" | "metaDescription";
  expected: string | null;
  value: string;
};

export function planSafeMetadataFixes(
  translations: Array<{
    locale: "nl" | "en" | "fr";
    name: string;
    shortDescription: string | null;
    seoTitle: string | null;
    metaDescription: string | null;
  }>
): MetadataFix[] {
  const fixes: MetadataFix[] = [];
  for (const translation of translations) {
    const title = `${translation.name.trim()} | De Notenman`;
    if (!translation.seoTitle?.trim() && title.length >= 25 && title.length <= 65) {
      fixes.push({ locale: translation.locale, field: "seoTitle", expected: translation.seoTitle, value: title });
    }

    const summary = toProductPlainText(translation.shortDescription).replace(/\s+/g, " ").trim();
    if (!translation.metaDescription?.trim() && summary.length >= 80 && summary.length <= 170) {
      fixes.push({ locale: translation.locale, field: "metaDescription", expected: translation.metaDescription, value: summary });
    }
  }
  return fixes;
}

/** Only administrators may write SEO metadata; staff may still run audits. */
export function canApplyMetadataFixes(role: "OWNER" | "ADMIN" | "STAFF"): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Stable snapshot of the exact proposals displayed to an administrator. */
export function metadataFixPreview(fixes: MetadataFix[]): string {
  return JSON.stringify([...fixes].sort((a, b) =>
    a.locale.localeCompare(b.locale) || a.field.localeCompare(b.field)
  ));
}
