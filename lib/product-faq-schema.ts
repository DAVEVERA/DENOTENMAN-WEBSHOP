import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export const FAQ_LOCALES = ["nl", "en", "fr"] as const;
export const FAQ_STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
export const FAQ_PLACEMENTS = [
  "BELOW_DESCRIPTION",
  "BELOW_PRODUCT_DETAILS",
  "BEFORE_REVIEWS",
  "PAGE_BOTTOM",
] as const;
export const FAQ_MEDIA_TYPES = ["IMAGE", "INFOGRAPHIC", "INSTRUCTION"] as const;

export const FAQ_MAX_ITEMS = 50;

export const faqTranslationInputSchema = z.object({
  locale: z.enum(FAQ_LOCALES),
  question: z.string().trim().max(240),
  answerHtml: z.string().trim().max(30_000),
  mediaLabel: z.string().trim().max(240).nullable().optional(),
}).superRefine((value, context) => {
  const hasQuestion = value.question.length > 0;
  const hasAnswer = plainTextFromFaqHtml(value.answerHtml).length > 0;
  if (hasQuestion !== hasAnswer) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Vraag en antwoord moeten samen ingevuld zijn." });
  }
});

const faqDraftInputBaseSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  itemVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(120),
  placement: z.enum(FAQ_PLACEMENTS),
  translations: z.array(faqTranslationInputSchema).max(FAQ_LOCALES.length),
});

function uniqueTranslationLocales(value: { translations: Array<{ locale: string }> }, context: z.RefinementCtx) {
  if (new Set(value.translations.map((entry) => entry.locale)).size !== value.translations.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Elke taal mag maar eenmaal voorkomen." });
  }
}

export const faqDraftInputSchema = faqDraftInputBaseSchema.superRefine(uniqueTranslationLocales);

export const faqCreateInputSchema = faqDraftInputBaseSchema.omit({ itemVersion: true }).extend({
  placement: z.enum(FAQ_PLACEMENTS).default("BELOW_PRODUCT_DETAILS"),
}).superRefine(uniqueTranslationLocales);

export const faqActionInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  itemVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const faqReorderInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(120),
  itemIds: z.array(z.string().min(1)).max(FAQ_MAX_ITEMS),
}).superRefine((value, context) => {
  if (new Set(value.itemIds).size !== value.itemIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Item-ID's moeten uniek zijn." });
  }
});

const FAQ_ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "blockquote"];

export function sanitizeFaqHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: FAQ_ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: { ...attributes, rel: "noopener noreferrer" },
      }),
    },
  }).trim();
}

export function plainTextFromFaqHtml(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

export function normalizeFaqTranslations(
  translations: z.infer<typeof faqTranslationInputSchema>[],
) {
  return translations
    .map((translation) => ({
      locale: translation.locale,
      question: translation.question.trim(),
      answerHtml: sanitizeFaqHtml(translation.answerHtml),
      mediaLabel: translation.mediaLabel?.trim() || null,
    }))
    .filter((translation) => translation.question && plainTextFromFaqHtml(translation.answerHtml));
}

export function hasPublishableFaqTranslation(
  translations: Array<{ question: string; answerHtml: string }>,
): boolean {
  return translations.some((translation) =>
    translation.question.trim().length > 0 && plainTextFromFaqHtml(translation.answerHtml).length > 0
  );
}

export type FaqCreateInput = z.infer<typeof faqCreateInputSchema>;
export type FaqDraftInput = z.infer<typeof faqDraftInputSchema>;
