import { assessCopywriterCompleteness } from "./completeness";
import {
  COPYWRITER_FIELD_LIMITS,
  COPYWRITER_REQUIRED_FIELDS,
  copywriterPersistedProposalSchema,
  type CopywriterFieldName,
  type CopywriterPersistedProposal,
} from "./schema";
import type { CopywriterSourceSnapshot } from "./snapshot";

export type CopywriterProductDto = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  active: boolean;
  updatedAt: string;
  completeness: "COMPLETE" | "MISSING_TEXT" | "MISSING_SEO" | "MISSING_PRODUCT_FACTS" | "NEEDS_REVIEW";
  attentionReasons: string[];
};

export type CopywriterFieldDto = {
  name: CopywriterFieldName;
  label: string;
  group: string;
  current: string;
  proposed: string | null;
  maxLength: number;
  htmlMaxLength?: number;
  sourcePaths: string[];
  qualityStatus: string;
  qualityReason: string;
  warnings: string[];
  applyAllowed: boolean;
};

export type CopywriterProposalDto = {
  id: string;
  productId: string;
  product: CopywriterProductDto;
  locale: "nl";
  status: "GENERATING" | "DRAFT" | "APPLIED" | "FAILED";
  sourceProductVersion: string;
  protectedFactsHash: string;
  fields: CopywriterFieldDto[];
};

export type CopywriterProposalRecord = {
  id: string;
  productId: string;
  requestedByAdminUserId: string;
  status: "GENERATING" | "DRAFT" | "APPLIED" | "FAILED";
  sourceProductVersion: Date;
  sourceSnapshot: unknown;
  proposedFields: unknown;
};

const fieldMeta: Record<CopywriterFieldName, { label: string; group: string }> = {
  name: { label: "Productnaam", group: "Identiteit" },
  slug: { label: "Slug", group: "Identiteit" },
  shortDescription: { label: "Korte omschrijving", group: "Verkooptekst" },
  descriptionHtml: { label: "Volledige omschrijving", group: "Verkooptekst" },
  seoTitle: { label: "SEO-titel", group: "Vindbaarheid" },
  metaDescription: { label: "Meta-omschrijving", group: "Vindbaarheid" },
  promotionText: { label: "Productactietekst", group: "Verkooptekst" },
  ingredients: { label: "Ingrediënten", group: "Productfeiten" },
  allergens: { label: "Allergenen", group: "Productfeiten" },
  mayContainTraces: { label: "Kan sporen bevatten van", group: "Productfeiten" },
};

function currentValue(snapshot: CopywriterSourceSnapshot, field: CopywriterFieldName): string {
  if (field === "name" || field === "slug") return snapshot.translation[field];
  if (field === "ingredients" || field === "allergens" || field === "mayContainTraces") {
    return snapshot.facts[field] ?? "";
  }
  return snapshot.translation[field] ?? "";
}

export function copywriterProductDto(
  snapshot: CopywriterSourceSnapshot,
  imageUrl: string | null,
): CopywriterProductDto {
  const completeness = assessCopywriterCompleteness(snapshot);
  return {
    id: snapshot.product.id,
    name: snapshot.translation.name || snapshot.product.slug,
    sku: snapshot.product.sku,
    imageUrl,
    active: snapshot.product.isActive,
    updatedAt: snapshot.product.updatedAt,
    completeness: completeness.status,
    attentionReasons: COPYWRITER_REQUIRED_FIELDS
      .filter((field) => completeness.fields[field].status !== "COMPLETE" && completeness.fields[field].status !== "NOT_APPLICABLE")
      .map((field) => completeness.fields[field].reason),
  };
}

export function copywriterProposalDto(
  record: CopywriterProposalRecord,
  snapshot: CopywriterSourceSnapshot,
  imageUrl: string | null,
): CopywriterProposalDto {
  const product = copywriterProductDto(snapshot, imageUrl);
  const completeness = assessCopywriterCompleteness(snapshot);
  const persisted: CopywriterPersistedProposal | null = record.proposedFields
    ? copywriterPersistedProposalSchema.parse(record.proposedFields)
    : null;

  return {
    id: record.id,
    productId: record.productId,
    product,
    locale: "nl",
    status: record.status,
    sourceProductVersion: record.sourceProductVersion.toISOString(),
    protectedFactsHash: persisted?.protectedFactsHash ?? "",
    fields: COPYWRITER_REQUIRED_FIELDS.map((field) => {
      const proposed = persisted?.fields[field];
      const meta = fieldMeta[field];
      const sourceStatus = "sourceStatus" in (proposed ?? {})
        ? (proposed as { sourceStatus?: string }).sourceStatus
        : null;
      const warnings = sourceStatus === "MISSING_VERIFIED_SOURCE"
        ? ["Geverifieerde productinformatie ontbreekt. Dit veld kan niet worden toegepast."]
        : [];
      return {
        name: field,
        label: meta.label,
        group: meta.group,
        current: currentValue(snapshot, field),
        proposed: proposed?.proposed ?? null,
        maxLength: COPYWRITER_FIELD_LIMITS[field].text,
        ...(field === "descriptionHtml" ? { htmlMaxLength: COPYWRITER_FIELD_LIMITS.descriptionHtml.html } : {}),
        sourcePaths: proposed?.evidencePaths ?? [],
        qualityStatus: completeness.fields[field].status,
        qualityReason: proposed?.reason ?? completeness.fields[field].reason,
        warnings,
        applyAllowed: proposed?.applyAllowed ?? false,
      };
    }),
  };
}
