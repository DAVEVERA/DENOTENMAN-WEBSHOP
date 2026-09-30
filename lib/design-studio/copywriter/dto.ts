import { assessCopywriterCompleteness } from "./completeness";
import {
  COPYWRITER_FIELD_LIMITS,
  COPYWRITER_REQUIRED_FIELDS,
  copywriterPersistedProposalSchema,
  isCopywriterProductInfoField,
  type CopywriterFieldName,
  type CopywriterPersistedProposal,
} from "./schema";
import { copywriterProductInfoValue, type CopywriterSourceSnapshot } from "./snapshot";

export type CopywriterProposalStatus = "GENERATING" | "DRAFT" | "APPLIED" | "FAILED";

export type CopywriterLatestProposalDto = {
  status: CopywriterProposalStatus;
  createdAt: string;
  appliedAt: string | null;
  errorCode: string | null;
};

export type CopywriterAttentionFieldDto = {
  field: CopywriterFieldName;
  label: string;
  reason: string;
  /** MISSING needs new text; NEEDS_REVIEW can also be kept as is. */
  kind: "MISSING" | "NEEDS_REVIEW";
  /** Always false: the CopyWriter now proposes every field, including product info. */
  outsideCopywriter: boolean;
};

export type CopywriterProductDto = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  active: boolean;
  updatedAt: string;
  completeness: "COMPLETE" | "MISSING_TEXT" | "MISSING_SEO" | "MISSING_PRODUCT_FACTS" | "NEEDS_REVIEW";
  attentionReasons: string[];
  attentionFields: CopywriterAttentionFieldDto[];
  acceptedFields: CopywriterFieldName[];
  latestProposal: CopywriterLatestProposalDto | null;
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
  /** Product info only: where the proposed value comes from. */
  sourceStatus: "SOURCE_EXACT" | "AI_ESTIMATE" | "ADMIN_ENTERED" | "MISSING_VERIFIED_SOURCE" | null;
  /** Nutrition only: the unit of the value, per 100 g. */
  unit?: string;
};

export type CopywriterProposalDto = {
  id: string;
  productId: string;
  product: CopywriterProductDto;
  locale: "nl";
  status: CopywriterProposalStatus;
  sourceProductVersion: string;
  protectedFactsHash: string;
  /** The product changed after this proposal was written; it can no longer be applied. */
  stale: boolean;
  createdAt: string | null;
  fields: CopywriterFieldDto[];
};

export type CopywriterProposalRecord = {
  id: string;
  productId: string;
  requestedByAdminUserId: string;
  status: CopywriterProposalStatus;
  sourceProductVersion: Date;
  sourceSnapshot: unknown;
  proposedFields: unknown;
  createdAt?: Date;
};

export type CopywriterProductDtoOptions = {
  acceptedFields?: ReadonlySet<CopywriterFieldName>;
  latestProposal?: CopywriterLatestProposalDto | null;
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
  nutritionEnergyKj: { label: "Energie (kJ)", group: "Voedingswaarden per 100 g" },
  nutritionEnergyKcal: { label: "Energie (kcal)", group: "Voedingswaarden per 100 g" },
  nutritionFat: { label: "Vetten", group: "Voedingswaarden per 100 g" },
  nutritionSaturatedFat: { label: "Waarvan verzadigd", group: "Voedingswaarden per 100 g" },
  nutritionCarbohydrates: { label: "Koolhydraten", group: "Voedingswaarden per 100 g" },
  nutritionSugars: { label: "Waarvan suikers", group: "Voedingswaarden per 100 g" },
  nutritionFiber: { label: "Vezels", group: "Voedingswaarden per 100 g" },
  nutritionProtein: { label: "Eiwitten", group: "Voedingswaarden per 100 g" },
  nutritionSalt: { label: "Zout", group: "Voedingswaarden per 100 g" },
};

const nutritionUnit: Partial<Record<CopywriterFieldName, string>> = {
  nutritionEnergyKj: "kJ",
  nutritionEnergyKcal: "kcal",
  nutritionFat: "g",
  nutritionSaturatedFat: "g",
  nutritionCarbohydrates: "g",
  nutritionSugars: "g",
  nutritionFiber: "g",
  nutritionProtein: "g",
  nutritionSalt: "g",
};

const sourceStatusWarnings: Record<string, string> = {
  AI_ESTIMATE: "AI-schatting. Controleer dit tegen het etiket of de specificatie van de leverancier voordat je opslaat.",
  ADMIN_ENTERED: "Door jou ingevuld. Controleer dit tegen het etiket voordat je opslaat.",
  MISSING_VERIFIED_SOURCE: "Geen waarde beschikbaar. Vul dit in bij het product.",
};

export function copywriterFieldLabel(field: CopywriterFieldName): string {
  return fieldMeta[field].label;
}

export function currentValue(snapshot: CopywriterSourceSnapshot, field: CopywriterFieldName): string {
  if (field === "name" || field === "slug") return snapshot.translation[field];
  if (isCopywriterProductInfoField(field)) return copywriterProductInfoValue(snapshot, field) ?? "";
  return snapshot.translation[field] ?? "";
}

export function copywriterProductDto(
  snapshot: CopywriterSourceSnapshot,
  imageUrl: string | null,
  options: CopywriterProductDtoOptions = {},
): CopywriterProductDto {
  const completeness = assessCopywriterCompleteness(snapshot, { acceptedFields: options.acceptedFields });
  const attentionFields = COPYWRITER_REQUIRED_FIELDS
    .filter((field) => completeness.fields[field].status === "MISSING" || completeness.fields[field].status === "NEEDS_REVIEW")
    .map((field) => ({
      field,
      label: fieldMeta[field].label,
      reason: completeness.fields[field].reason,
      kind: completeness.fields[field].status as "MISSING" | "NEEDS_REVIEW",
      outsideCopywriter: false,
    }));
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
    attentionFields,
    acceptedFields: [...(options.acceptedFields ?? [])].filter((field) => completeness.fields[field].status === "COMPLETE"),
    latestProposal: options.latestProposal ?? null,
  };
}

export function copywriterProposalDto(
  record: CopywriterProposalRecord,
  snapshot: CopywriterSourceSnapshot,
  imageUrl: string | null,
  options: CopywriterProductDtoOptions & {
    /** Current product state; defaults to the snapshot the proposal was written from. */
    currentSnapshot?: CopywriterSourceSnapshot;
    stale?: boolean;
  } = {},
): CopywriterProposalDto {
  const current = options.currentSnapshot ?? snapshot;
  const product = copywriterProductDto(current, imageUrl, options);
  const completeness = assessCopywriterCompleteness(current, { acceptedFields: options.acceptedFields });
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
    stale: options.stale ?? false,
    createdAt: record.createdAt?.toISOString() ?? null,
    fields: COPYWRITER_REQUIRED_FIELDS.map((field) => {
      const proposed = persisted?.fields[field];
      const meta = fieldMeta[field];
      const sourceStatus = "sourceStatus" in (proposed ?? {})
        ? (proposed as { sourceStatus?: string }).sourceStatus
        : null;
      const warnings = sourceStatus && sourceStatusWarnings[sourceStatus] ? [sourceStatusWarnings[sourceStatus]] : [];
      return {
        name: field,
        label: meta.label,
        group: meta.group,
        current: currentValue(current, field),
        proposed: proposed?.proposed ?? null,
        maxLength: COPYWRITER_FIELD_LIMITS[field].text,
        ...(field === "descriptionHtml" ? { htmlMaxLength: COPYWRITER_FIELD_LIMITS.descriptionHtml.html } : {}),
        sourcePaths: proposed?.evidencePaths ?? [],
        qualityStatus: completeness.fields[field].status,
        qualityReason: proposed?.reason ?? completeness.fields[field].reason,
        warnings,
        applyAllowed: proposed?.applyAllowed ?? false,
        sourceStatus: (sourceStatus ?? null) as CopywriterFieldDto["sourceStatus"],
        ...(nutritionUnit[field] ? { unit: nutritionUnit[field] } : {}),
      };
    }),
  };
}
