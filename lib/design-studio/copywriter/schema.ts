import { z } from "zod";

import {
  sanitizeProductHtml,
  toProductPlainText,
} from "../../product-content";

export const COPYWRITER_SCHEMA_VERSION = 1 as const;

export const COPYWRITER_REQUIRED_FIELDS = [
  "name",
  "slug",
  "shortDescription",
  "descriptionHtml",
  "seoTitle",
  "metaDescription",
  "promotionText",
  "ingredients",
  "allergens",
  "mayContainTraces",
  "nutritionEnergyKj",
  "nutritionEnergyKcal",
  "nutritionFat",
  "nutritionSaturatedFat",
  "nutritionCarbohydrates",
  "nutritionSugars",
  "nutritionFiber",
  "nutritionProtein",
  "nutritionSalt",
] as const;

export const COPYWRITER_EDITORIAL_FIELDS = [
  "name",
  "slug",
  "shortDescription",
  "descriptionHtml",
  "seoTitle",
  "metaDescription",
  "promotionText",
] as const;

export const COPYWRITER_FACT_FIELDS = [
  "ingredients",
  "allergens",
  "mayContainTraces",
] as const;

/** Nutrition values per 100 g, stored as product attributes under these keys. */
export const COPYWRITER_NUTRITION_FIELDS = [
  "nutritionEnergyKj",
  "nutritionEnergyKcal",
  "nutritionFat",
  "nutritionSaturatedFat",
  "nutritionCarbohydrates",
  "nutritionSugars",
  "nutritionFiber",
  "nutritionProtein",
  "nutritionSalt",
] as const;

export const COPYWRITER_NUTRITION_ATTRIBUTE_KEYS = {
  nutritionEnergyKj: "nutrition.energyKj",
  nutritionEnergyKcal: "nutrition.energyKcal",
  nutritionFat: "nutrition.fat",
  nutritionSaturatedFat: "nutrition.saturatedFat",
  nutritionCarbohydrates: "nutrition.carbohydrates",
  nutritionSugars: "nutrition.sugars",
  nutritionFiber: "nutrition.fiber",
  nutritionProtein: "nutrition.protein",
  nutritionSalt: "nutrition.salt",
} as const satisfies Record<(typeof COPYWRITER_NUTRITION_FIELDS)[number], string>;

export const COPYWRITER_FIELD_LIMITS = {
  name: { text: 180 },
  slug: { text: 160 },
  shortDescription: { text: 220 },
  descriptionHtml: { text: 20_000, html: 50_000 },
  seoTitle: { text: 60 },
  metaDescription: { text: 160 },
  promotionText: { text: 160 },
  ingredients: { text: 10_000 },
  allergens: { text: 10_000 },
  mayContainTraces: { text: 10_000 },
  nutritionEnergyKj: { text: 12 },
  nutritionEnergyKcal: { text: 12 },
  nutritionFat: { text: 12 },
  nutritionSaturatedFat: { text: 12 },
  nutritionCarbohydrates: { text: 12 },
  nutritionSugars: { text: 12 },
  nutritionFiber: { text: 12 },
  nutritionProtein: { text: 12 },
  nutritionSalt: { text: 12 },
} as const;

export type CopywriterFieldName = (typeof COPYWRITER_REQUIRED_FIELDS)[number];
export type CopywriterEditorialFieldName = (typeof COPYWRITER_EDITORIAL_FIELDS)[number];
export type CopywriterFactFieldName = (typeof COPYWRITER_FACT_FIELDS)[number];
export type CopywriterNutritionFieldName = (typeof COPYWRITER_NUTRITION_FIELDS)[number];
/** Fields stored as product attributes: the text facts and the nutrition values. */
export type CopywriterProductInfoFieldName = CopywriterFactFieldName | CopywriterNutritionFieldName;

export function isCopywriterNutritionField(field: string): field is CopywriterNutritionFieldName {
  return (COPYWRITER_NUTRITION_FIELDS as readonly string[]).includes(field);
}

export function isCopywriterProductInfoField(field: string): field is CopywriterProductInfoFieldName {
  return (COPYWRITER_FACT_FIELDS as readonly string[]).includes(field) || isCopywriterNutritionField(field);
}

/** Evidence path of a product info field: facts.<field> or nutrition.<key>. */
export function copywriterProductInfoPath(field: CopywriterProductInfoFieldName): string {
  return isCopywriterNutritionField(field)
    ? COPYWRITER_NUTRITION_ATTRIBUTE_KEYS[field]
    : `facts.${field}`;
}

export const copywriterFieldNameSchema = z.enum(COPYWRITER_REQUIRED_FIELDS);
export const copywriterEditorialFieldNameSchema = z.enum(COPYWRITER_EDITORIAL_FIELDS);
export const copywriterFactFieldNameSchema = z.enum(COPYWRITER_FACT_FIELDS);

export function normalizeCopywriterText(value: string | null | undefined): string {
  return toProductPlainText(value).normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function normalizeCopywriterHtml(value: string | null | undefined): string {
  return sanitizeProductHtml(value).normalize("NFC").trim();
}

function normalizedTextSchema(maximum: number, minimum = 1) {
  return z.string()
    .transform(normalizeCopywriterText)
    .pipe(z.string().min(minimum).max(maximum));
}

const nameSchema = normalizedTextSchema(COPYWRITER_FIELD_LIMITS.name.text);
const slugSchema = z.string()
  .trim()
  .min(2)
  .max(COPYWRITER_FIELD_LIMITS.slug.text)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const shortDescriptionSchema = normalizedTextSchema(COPYWRITER_FIELD_LIMITS.shortDescription.text);
const descriptionHtmlSchema = z.string()
  .max(COPYWRITER_FIELD_LIMITS.descriptionHtml.html)
  .transform(normalizeCopywriterHtml)
  .superRefine((value, context) => {
    const textLength = normalizeCopywriterText(value).length;
    if (textLength === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Volledige omschrijving mag niet leeg zijn.",
      });
    }
    if (textLength > COPYWRITER_FIELD_LIMITS.descriptionHtml.text) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: COPYWRITER_FIELD_LIMITS.descriptionHtml.text,
        type: "string",
        inclusive: true,
        exact: false,
        message: "Volledige omschrijving mag maximaal 20.000 zichtbare tekens bevatten.",
      });
    }
  });
const seoTitleSchema = normalizedTextSchema(COPYWRITER_FIELD_LIMITS.seoTitle.text);
const metaDescriptionSchema = normalizedTextSchema(COPYWRITER_FIELD_LIMITS.metaDescription.text);
const promotionTextSchema = normalizedTextSchema(COPYWRITER_FIELD_LIMITS.promotionText.text);
const factTextSchema = z.string()
  .trim()
  .min(1)
  .max(COPYWRITER_FIELD_LIMITS.ingredients.text);

const reasonSchema = z.string().transform(normalizeCopywriterText).pipe(z.string().min(1).max(500));
const evidencePathsSchema = z.array(
  z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_.[\]-]+$/u)
).min(1).max(12);

function editableFieldSchema<T extends z.ZodTypeAny>(proposedSchema: T) {
  return z.object({
    proposed: proposedSchema,
    applyAllowed: z.literal(true),
    reason: reasonSchema,
    evidencePaths: evidencePathsSchema,
  }).strict();
}

// Proposed by the server (never the model) when a promotion text exists without a
// verified lower sale price: applying it empties the stored promotion text.
export const COPYWRITER_CLEAR_PROMOTION = "" as const;
const clearPromotionSchema = z.object({
  proposed: z.literal(COPYWRITER_CLEAR_PROMOTION),
  applyAllowed: z.literal(true),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

const unavailablePromotionSchema = z.object({
  proposed: z.null(),
  applyAllowed: z.literal(false),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

const sourceExactFactSchema = z.object({
  sourceStatus: z.literal("SOURCE_EXACT"),
  proposed: factTextSchema,
  applyAllowed: z.literal(true),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

// No stored value: the model's best estimate. Never saved without an explicit admin choice.
const aiEstimateFactSchema = z.object({
  sourceStatus: z.literal("AI_ESTIMATE"),
  proposed: factTextSchema,
  applyAllowed: z.literal(true),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

// No stored value and typed in by an admin in the CopyWriter. Only produced by an edit.
const adminEnteredFactSchema = z.object({
  sourceStatus: z.literal("ADMIN_ENTERED"),
  proposed: factTextSchema,
  applyAllowed: z.literal(true),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

const missingVerifiedSourceFactSchema = z.object({
  sourceStatus: z.literal("MISSING_VERIFIED_SOURCE"),
  proposed: z.null(),
  applyAllowed: z.literal(false),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

export const copywriterFactProposalSchema = z.discriminatedUnion("sourceStatus", [
  sourceExactFactSchema,
  aiEstimateFactSchema,
  adminEnteredFactSchema,
  missingVerifiedSourceFactSchema,
]);

/** A positive number with at most three decimals; Dutch decimal comma or a dot. */
export const COPYWRITER_NUTRITION_VALUE_PATTERN = /^\d{1,6}(?:[.,]\d{1,3})?$/u;

/** Parses a stored or proposed nutrition value; null when it is not a plain number. */
export function parseCopywriterNutritionValue(value: string | null | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!COPYWRITER_NUTRITION_VALUE_PATTERN.test(trimmed)) return null;
  return Number(trimmed.replace(",", "."));
}

// Estimates are stored with a Dutch decimal comma, like the product editor shows them.
const nutritionValueSchema = z.string()
  .trim()
  .regex(COPYWRITER_NUTRITION_VALUE_PATTERN, "Gebruik een positief getal met maximaal drie decimalen.")
  .transform((value) => value.replace(".", ","));

const nutritionProposalFields = {
  applyAllowed: z.literal(true),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
};

export const copywriterNutritionProposalSchema = z.discriminatedUnion("sourceStatus", [
  // A stored value is copied as is, even when an older entry uses another notation.
  z.object({ sourceStatus: z.literal("SOURCE_EXACT"), proposed: z.string().trim().min(1).max(12), ...nutritionProposalFields }).strict(),
  z.object({ sourceStatus: z.literal("AI_ESTIMATE"), proposed: nutritionValueSchema, ...nutritionProposalFields }).strict(),
  z.object({ sourceStatus: z.literal("ADMIN_ENTERED"), proposed: nutritionValueSchema, ...nutritionProposalFields }).strict(),
  missingVerifiedSourceFactSchema,
]);

export const copywriterProposedFieldsSchema = z.object({
  name: editableFieldSchema(nameSchema),
  slug: editableFieldSchema(slugSchema),
  shortDescription: editableFieldSchema(shortDescriptionSchema),
  descriptionHtml: editableFieldSchema(descriptionHtmlSchema),
  seoTitle: editableFieldSchema(seoTitleSchema),
  metaDescription: editableFieldSchema(metaDescriptionSchema),
  promotionText: z.union([editableFieldSchema(promotionTextSchema), clearPromotionSchema, unavailablePromotionSchema]),
  ingredients: copywriterFactProposalSchema,
  allergens: copywriterFactProposalSchema,
  mayContainTraces: copywriterFactProposalSchema,
  nutritionEnergyKj: copywriterNutritionProposalSchema,
  nutritionEnergyKcal: copywriterNutritionProposalSchema,
  nutritionFat: copywriterNutritionProposalSchema,
  nutritionSaturatedFat: copywriterNutritionProposalSchema,
  nutritionCarbohydrates: copywriterNutritionProposalSchema,
  nutritionSugars: copywriterNutritionProposalSchema,
  nutritionFiber: copywriterNutritionProposalSchema,
  nutritionProtein: copywriterNutritionProposalSchema,
  nutritionSalt: copywriterNutritionProposalSchema,
}).strict();

export const copywriterProviderOutputSchema = z.object({
  schemaVersion: z.literal(COPYWRITER_SCHEMA_VERSION),
  fields: copywriterProposedFieldsSchema,
}).strict();

const sourceHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

const legacyNutritionPlaceholder = {
  sourceStatus: "MISSING_VERIFIED_SOURCE",
  proposed: null,
  applyAllowed: false,
  reason: "Dit voorstel is geschreven voordat de CopyWriter voedingswaarden invulde. Schrijf een nieuw voorstel.",
  evidencePaths: ["product.id"],
} as const;

// Drafts stored before the nutrition fields existed get a locked placeholder per value.
function withLegacyNutritionFields(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as { fields?: unknown };
  if (!record.fields || typeof record.fields !== "object") return value;
  const fields = { ...(record.fields as Record<string, unknown>) };
  for (const field of COPYWRITER_NUTRITION_FIELDS) {
    if (!(field in fields)) fields[field] = legacyNutritionPlaceholder;
  }
  return { ...record, fields };
}

export const copywriterPersistedProposalSchema = z.preprocess(
  withLegacyNutritionFields,
  copywriterProviderOutputSchema.extend({
    sourceHash: sourceHashSchema,
    protectedFactsHash: sourceHashSchema,
  }).strict(),
);

export type CopywriterFactProposal = z.infer<typeof copywriterFactProposalSchema>;
export type CopywriterNutritionProposal = z.infer<typeof copywriterNutritionProposalSchema>;
export type CopywriterProposedFields = z.infer<typeof copywriterProposedFieldsSchema>;
export type CopywriterProviderOutput = z.input<typeof copywriterProviderOutputSchema>;
export type ParsedCopywriterProviderOutput = z.output<typeof copywriterProviderOutputSchema>;
export type CopywriterPersistedProposal = z.output<typeof copywriterPersistedProposalSchema>;

const editorialJsonSchema = (maximum: number) => ({
  type: "object",
  additionalProperties: false,
  required: ["proposed", "applyAllowed", "reason", "evidencePaths"],
  properties: {
    proposed: { type: "string", minLength: 1, maxLength: maximum },
    applyAllowed: { type: "boolean", const: true },
    reason: { type: "string", minLength: 1, maxLength: 500 },
    evidencePaths: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
  },
});

const factJsonVariant = (sourceStatus: "SOURCE_EXACT" | "AI_ESTIMATE", maximum: number) => ({
  type: "object",
  additionalProperties: false,
  required: ["sourceStatus", "proposed", "applyAllowed", "reason", "evidencePaths"],
  properties: {
    sourceStatus: { type: "string", const: sourceStatus },
    proposed: { type: "string", minLength: 1, maxLength: maximum },
    applyAllowed: { type: "boolean", const: true },
    reason: { type: "string", minLength: 1, maxLength: 500 },
    evidencePaths: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", minLength: 1, maxLength: 160 } },
  },
});

const missingFactJsonVariant = {
  type: "object",
  additionalProperties: false,
  required: ["sourceStatus", "proposed", "applyAllowed", "reason", "evidencePaths"],
  properties: {
    sourceStatus: { type: "string", const: "MISSING_VERIFIED_SOURCE" },
    proposed: { type: "null" },
    applyAllowed: { type: "boolean", const: false },
    reason: { type: "string", minLength: 1, maxLength: 500 },
    evidencePaths: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", minLength: 1, maxLength: 160 } },
  },
} as const;

const nutritionJsonSchema = {
  oneOf: [factJsonVariant("SOURCE_EXACT", 12), factJsonVariant("AI_ESTIMATE", 12), missingFactJsonVariant],
} as const;

const factJsonSchema = {
  oneOf: [
    factJsonVariant("AI_ESTIMATE", 10_000),
    {
      type: "object",
      additionalProperties: false,
      required: ["sourceStatus", "proposed", "applyAllowed", "reason", "evidencePaths"],
      properties: {
        sourceStatus: { type: "string", const: "SOURCE_EXACT" },
        proposed: { type: "string", minLength: 1, maxLength: 10_000 },
        applyAllowed: { type: "boolean", const: true },
        reason: { type: "string", minLength: 1, maxLength: 500 },
        evidencePaths: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", minLength: 1, maxLength: 160 } },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["sourceStatus", "proposed", "applyAllowed", "reason", "evidencePaths"],
      properties: {
        sourceStatus: { type: "string", const: "MISSING_VERIFIED_SOURCE" },
        proposed: { type: "null" },
        applyAllowed: { type: "boolean", const: false },
        reason: { type: "string", minLength: 1, maxLength: 500 },
        evidencePaths: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", minLength: 1, maxLength: 160 } },
      },
    },
  ],
} as const;

export const copywriterProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "fields"],
  properties: {
    schemaVersion: { type: "integer", const: COPYWRITER_SCHEMA_VERSION },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [...COPYWRITER_REQUIRED_FIELDS],
      properties: {
        name: editorialJsonSchema(COPYWRITER_FIELD_LIMITS.name.text),
        slug: editorialJsonSchema(COPYWRITER_FIELD_LIMITS.slug.text),
        shortDescription: editorialJsonSchema(COPYWRITER_FIELD_LIMITS.shortDescription.text),
        descriptionHtml: editorialJsonSchema(COPYWRITER_FIELD_LIMITS.descriptionHtml.html),
        seoTitle: editorialJsonSchema(COPYWRITER_FIELD_LIMITS.seoTitle.text),
        metaDescription: editorialJsonSchema(COPYWRITER_FIELD_LIMITS.metaDescription.text),
        promotionText: {
          oneOf: [
            editorialJsonSchema(COPYWRITER_FIELD_LIMITS.promotionText.text),
            {
              type: "object",
              additionalProperties: false,
              required: ["proposed", "applyAllowed", "reason", "evidencePaths"],
              properties: {
                proposed: { type: "null" },
                applyAllowed: { type: "boolean", const: false },
                reason: { type: "string", minLength: 1, maxLength: 500 },
                evidencePaths: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", minLength: 1, maxLength: 160 } },
              },
            },
          ],
        },
        ingredients: factJsonSchema,
        allergens: factJsonSchema,
        mayContainTraces: factJsonSchema,
        nutritionEnergyKj: nutritionJsonSchema,
        nutritionEnergyKcal: nutritionJsonSchema,
        nutritionFat: nutritionJsonSchema,
        nutritionSaturatedFat: nutritionJsonSchema,
        nutritionCarbohydrates: nutritionJsonSchema,
        nutritionSugars: nutritionJsonSchema,
        nutritionFiber: nutritionJsonSchema,
        nutritionProtein: nutritionJsonSchema,
        nutritionSalt: nutritionJsonSchema,
      },
    },
  },
} as const;
