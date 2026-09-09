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
} as const;

export type CopywriterFieldName = (typeof COPYWRITER_REQUIRED_FIELDS)[number];
export type CopywriterEditorialFieldName = (typeof COPYWRITER_EDITORIAL_FIELDS)[number];
export type CopywriterFactFieldName = (typeof COPYWRITER_FACT_FIELDS)[number];

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

const missingVerifiedSourceFactSchema = z.object({
  sourceStatus: z.literal("MISSING_VERIFIED_SOURCE"),
  proposed: z.null(),
  applyAllowed: z.literal(false),
  reason: reasonSchema,
  evidencePaths: evidencePathsSchema,
}).strict();

export const copywriterFactProposalSchema = z.discriminatedUnion("sourceStatus", [
  sourceExactFactSchema,
  missingVerifiedSourceFactSchema,
]);

export const copywriterProposedFieldsSchema = z.object({
  name: editableFieldSchema(nameSchema),
  slug: editableFieldSchema(slugSchema),
  shortDescription: editableFieldSchema(shortDescriptionSchema),
  descriptionHtml: editableFieldSchema(descriptionHtmlSchema),
  seoTitle: editableFieldSchema(seoTitleSchema),
  metaDescription: editableFieldSchema(metaDescriptionSchema),
  promotionText: z.union([editableFieldSchema(promotionTextSchema), unavailablePromotionSchema]),
  ingredients: copywriterFactProposalSchema,
  allergens: copywriterFactProposalSchema,
  mayContainTraces: copywriterFactProposalSchema,
}).strict();

export const copywriterProviderOutputSchema = z.object({
  schemaVersion: z.literal(COPYWRITER_SCHEMA_VERSION),
  fields: copywriterProposedFieldsSchema,
}).strict();

const sourceHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const copywriterPersistedProposalSchema = copywriterProviderOutputSchema.extend({
  sourceHash: sourceHashSchema,
  protectedFactsHash: sourceHashSchema,
}).strict();

export type CopywriterFactProposal = z.infer<typeof copywriterFactProposalSchema>;
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

const factJsonSchema = {
  oneOf: [
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
      },
    },
  },
} as const;
