import {
  COPYWRITER_FIELD_LIMITS,
  COPYWRITER_REQUIRED_FIELDS,
  normalizeCopywriterText,
  type CopywriterFieldName,
} from "./schema";
import type { CopywriterSourceSnapshot } from "./snapshot";

export const COPYWRITER_COMPLETENESS_STATUSES = [
  "COMPLETE",
  "MISSING_TEXT",
  "MISSING_SEO",
  "MISSING_PRODUCT_FACTS",
  "NEEDS_REVIEW",
] as const;

export type CopywriterCompletenessStatus = (typeof COPYWRITER_COMPLETENESS_STATUSES)[number];
export type CopywriterAttentionArea = "TEXT" | "SEO" | "PRODUCT_FACTS" | "REVIEW";
export type CopywriterFieldCompleteness = "COMPLETE" | "MISSING" | "NEEDS_REVIEW" | "NOT_APPLICABLE";

export const COPYWRITER_COMPLETENESS_LABELS: Record<CopywriterCompletenessStatus, string> = {
  COMPLETE: "Compleet",
  MISSING_TEXT: "Tekst mist",
  MISSING_SEO: "SEO mist",
  MISSING_PRODUCT_FACTS: "Productfeiten missen",
  NEEDS_REVIEW: "Controle nodig",
};

export type CopywriterCompletenessResult = {
  status: CopywriterCompletenessStatus;
  label: string;
  missingFields: CopywriterFieldName[];
  reviewFields: CopywriterFieldName[];
  attentionAreas: CopywriterAttentionArea[];
  fields: Record<CopywriterFieldName, {
    status: CopywriterFieldCompleteness;
    reason: string;
  }>;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function hasText(value: string | null): value is string {
  return Boolean(value?.trim());
}

export function assessCopywriterCompleteness(
  snapshot: CopywriterSourceSnapshot,
): CopywriterCompletenessResult {
  const states = Object.fromEntries(
    COPYWRITER_REQUIRED_FIELDS.map((field) => [field, {
      status: "COMPLETE" as CopywriterFieldCompleteness,
      reason: "Veld is aanwezig en blijft binnen de opslaggrens.",
    }])
  ) as CopywriterCompletenessResult["fields"];

  const missing = new Set<CopywriterFieldName>();
  const review = new Set<CopywriterFieldName>();

  const markMissing = (field: CopywriterFieldName, reason: string) => {
    missing.add(field);
    states[field] = { status: "MISSING", reason };
  };
  const markReview = (field: CopywriterFieldName, reason: string) => {
    review.add(field);
    states[field] = { status: "NEEDS_REVIEW", reason };
  };

  const name = snapshot.translation.name.trim();
  if (!name) markMissing("name", "Productnaam ontbreekt.");
  else if (name.length > COPYWRITER_FIELD_LIMITS.name.text) {
    markReview("name", "Productnaam overschrijdt de opslaggrens van 180 tekens.");
  }

  const slug = snapshot.translation.slug.trim();
  if (!slug) markMissing("slug", "Slug ontbreekt.");
  else if (
    slug.length < 2
    || slug.length > COPYWRITER_FIELD_LIMITS.slug.text
    || !slugPattern.test(slug)
  ) {
    markReview("slug", "Slug voldoet niet aan de live opslagvalidator.");
  }

  const shortDescription = snapshot.translation.shortDescription;
  if (!hasText(shortDescription)) {
    markMissing("shortDescription", "Korte omschrijving ontbreekt.");
  } else if (shortDescription.length > COPYWRITER_FIELD_LIMITS.shortDescription.text) {
    markReview("shortDescription", "Korte omschrijving overschrijdt 220 zichtbare tekens.");
  }

  const description = snapshot.translation.description;
  const descriptionHtml = snapshot.translation.descriptionHtml;
  if (!hasText(description) || !hasText(descriptionHtml)) {
    markMissing("descriptionHtml", "Volledige omschrijving ontbreekt.");
  } else if (
    description.length > COPYWRITER_FIELD_LIMITS.descriptionHtml.text
    || descriptionHtml.length > COPYWRITER_FIELD_LIMITS.descriptionHtml.html
  ) {
    markReview("descriptionHtml", "Volledige omschrijving overschrijdt de tekst- of HTML-opslaggrens.");
  }

  const seoTitle = snapshot.translation.seoTitle;
  if (!hasText(seoTitle)) markMissing("seoTitle", "SEO-titel ontbreekt.");
  else if (seoTitle.length > COPYWRITER_FIELD_LIMITS.seoTitle.text) {
    markReview("seoTitle", "SEO-titel overschrijdt 60 tekens.");
  }

  const metaDescription = snapshot.translation.metaDescription;
  if (!hasText(metaDescription)) markMissing("metaDescription", "Meta-omschrijving ontbreekt.");
  else if (metaDescription.length > COPYWRITER_FIELD_LIMITS.metaDescription.text) {
    markReview("metaDescription", "Meta-omschrijving overschrijdt 160 tekens.");
  }

  const hasRealSale = snapshot.product.salePriceCents !== null
    && snapshot.product.salePriceCents < snapshot.product.basePriceCents;
  const hasInvalidSale = snapshot.product.salePriceCents !== null
    && snapshot.product.salePriceCents >= snapshot.product.basePriceCents;
  const promotionText = snapshot.translation.promotionText;
  const normalizedPromotion = normalizeCopywriterText(promotionText).toLocaleLowerCase("nl-NL");

  if (hasInvalidSale) {
    markReview("promotionText", "Actieprijs is niet lager dan de normale prijs.");
  } else if (hasRealSale) {
    if (!hasText(promotionText)) markMissing("promotionText", "Productactietekst ontbreekt bij een echte actieprijs.");
    else if (promotionText.length > COPYWRITER_FIELD_LIMITS.promotionText.text) {
      markReview("promotionText", "Productactietekst overschrijdt 160 tekens.");
    }
  } else if (!hasText(promotionText) || ["niet van toepassing", "n.v.t.", "nvt"].includes(normalizedPromotion)) {
    states.promotionText = {
      status: "NOT_APPLICABLE",
      reason: "Geen echte actieprijs; productactietekst is niet verplicht.",
    };
  } else {
    markReview("promotionText", "Productactietekst heeft geen bevestigde lagere actieprijs als bron.");
  }

  for (const field of ["ingredients", "allergens", "mayContainTraces"] as const) {
    const value = snapshot.facts[field];
    if (!hasText(value)) markMissing(field, "Geverifieerde productinformatie ontbreekt.");
    else if (value.length > COPYWRITER_FIELD_LIMITS[field].text) {
      markReview(field, "Productinformatie overschrijdt 10.000 tekens.");
    }
  }

  const missingFields = COPYWRITER_REQUIRED_FIELDS.filter((field) => missing.has(field));
  const reviewFields = COPYWRITER_REQUIRED_FIELDS.filter((field) => review.has(field));
  const textFields = new Set<CopywriterFieldName>([
    "name", "slug", "shortDescription", "descriptionHtml", "promotionText",
  ]);
  const seoFields = new Set<CopywriterFieldName>(["seoTitle", "metaDescription"]);
  const factFields = new Set<CopywriterFieldName>(["ingredients", "allergens", "mayContainTraces"]);
  const attentionAreas: CopywriterAttentionArea[] = [];
  if (missingFields.some((field) => textFields.has(field))) attentionAreas.push("TEXT");
  if (missingFields.some((field) => seoFields.has(field))) attentionAreas.push("SEO");
  if (missingFields.some((field) => factFields.has(field))) attentionAreas.push("PRODUCT_FACTS");
  if (reviewFields.length) attentionAreas.push("REVIEW");

  let status: CopywriterCompletenessStatus = "COMPLETE";
  if (reviewFields.length) status = "NEEDS_REVIEW";
  else if (attentionAreas.includes("PRODUCT_FACTS")) status = "MISSING_PRODUCT_FACTS";
  else if (attentionAreas.includes("SEO")) status = "MISSING_SEO";
  else if (attentionAreas.includes("TEXT")) status = "MISSING_TEXT";

  return {
    status,
    label: COPYWRITER_COMPLETENESS_LABELS[status],
    missingFields,
    reviewFields,
    attentionAreas,
    fields: states,
  };
}

export const buildCopywriterCompleteness = assessCopywriterCompleteness;
export const getCopywriterCompleteness = assessCopywriterCompleteness;
