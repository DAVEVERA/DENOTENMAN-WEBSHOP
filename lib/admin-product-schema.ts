import { z } from "zod";
import { sanitizeProductHtml } from "./product-content";

const optionalSalePrice = z.number().int().nonnegative().nullable();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localeSchema = z.enum(["nl", "en", "fr"]);
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable();

export const productNutritionKeys = [
  "nutrition.energyKj",
  "nutrition.energyKcal",
  "nutrition.fat",
  "nutrition.saturatedFat",
  "nutrition.carbohydrates",
  "nutrition.sugars",
  "nutrition.fiber",
  "nutrition.protein",
  "nutrition.salt",
] as const;

const nutritionValueSchema = z
  .string()
  .trim()
  .max(64)
  .transform((value) => value || null)
  .or(z.null());

export const productNutritionInputSchema = z
  .object({
    "nutrition.energyKj": nutritionValueSchema.optional(),
    "nutrition.energyKcal": nutritionValueSchema.optional(),
    "nutrition.fat": nutritionValueSchema.optional(),
    "nutrition.saturatedFat": nutritionValueSchema.optional(),
    "nutrition.carbohydrates": nutritionValueSchema.optional(),
    "nutrition.sugars": nutritionValueSchema.optional(),
    "nutrition.fiber": nutritionValueSchema.optional(),
    "nutrition.protein": nutritionValueSchema.optional(),
    "nutrition.salt": nutritionValueSchema.optional(),
  })
  .strict();

export const productTranslationInputSchema = z.object({
  locale: localeSchema,
  slug: z.string().trim().min(2).max(160).regex(slugPattern),
  name: z.string().trim().min(1).max(180),
  shortDescription: optionalText(220),
  description: optionalText(20000),
  descriptionHtml: z
    .string()
    .max(50000)
    .nullable()
    .transform((value) => {
      const sanitized = sanitizeProductHtml(value);
      return sanitized || null;
    }),
  seoTitle: optionalText(60),
  metaDescription: optionalText(160),
  promotionText: optionalText(160),
});

const translationsInputSchema = z.preprocess(
  (value) => {
    if (!value || Array.isArray(value) || typeof value !== "object") return value;
    return Object.values(value);
  },
  z.array(productTranslationInputSchema).max(3)
);

export const productCategoryInputSchema = z.object({
  categoryId: z.string().cuid(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const productVariantInputSchema = z
  .object({
    id: z.string().cuid().optional(),
    sku: z.string().trim().min(1).max(80),
    label: z.string().trim().max(120).nullable(),
    weightGrams: z.number().int().positive().max(100000),
    preparation: z.enum(["RAW", "ROASTED"]),
    salting: z.enum(["UNSALTED", "SALTED"]),
    coating: z.enum(["NONE", "CHOCOLATE", "YOGHURT", "FLAVORED"]),
    isActive: z.boolean(),
    priceCents: z.number().int().nonnegative(),
    salePriceCents: optionalSalePrice,
    stock: z.number().int().nonnegative(),
  })
  .superRefine((variant, context) => {
    if (variant.salePriceCents !== null && variant.salePriceCents >= variant.priceCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salePriceCents"],
        message: "Actieprijs moet lager zijn dan de normale prijs.",
      });
    }
  });

const legacyTranslationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  shortDescription: optionalText(220),
  description: optionalText(20000),
});

export const productAdminInputSchema = z
  .object({
    version: z.string().datetime().optional(),
    sku: z.string().trim().min(1).max(80),
    slug: z.string().trim().min(2).max(160).regex(slugPattern).optional(),
    basePriceCents: z.number().int().nonnegative(),
    salePriceCents: optionalSalePrice,
    unit: z.enum(["WEIGHT", "VOLUME"]),
    isActive: z.boolean(),
    translation: legacyTranslationSchema.optional(),
    translations: translationsInputSchema.optional(),
    categoryIds: z.array(z.string().cuid()).max(2).default([]),
    categories: z.array(productCategoryInputSchema).max(2).optional(),
    nutrition: productNutritionInputSchema.optional(),
    recommendationIds: z.array(z.string().cuid()).max(3),
    variants: z.array(productVariantInputSchema).max(100),
  })
  .superRefine((product, context) => {
    if (product.salePriceCents !== null && product.salePriceCents >= product.basePriceCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salePriceCents"],
        message: "Actieprijs moet lager zijn dan de normale basisprijs.",
      });
    }

    const localized = product.translations ?? [];
    const nlTranslation = localized.find((translation) => translation.locale === "nl");
    if (!nlTranslation && !product.translation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["translations"],
        message: "Een Nederlandse vertaling is verplicht.",
      });
    }
    if (!nlTranslation && product.translation && !product.slug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "Een Nederlandse slug is verplicht.",
      });
    }

    const locales = localized.map((translation) => translation.locale);
    if (new Set(locales).size !== locales.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["translations"],
        message: "Elke producttaal kan maar één keer worden aangeleverd.",
      });
    }

    const variantSkus = product.variants.map((variant) => variant.sku.toLowerCase());
    if (new Set(variantSkus).size !== variantSkus.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "Variant-SKU's moeten binnen het product uniek zijn.",
      });
    }

    if (new Set(product.categoryIds).size !== product.categoryIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryIds"],
        message: "Een categorie kan maar één keer worden gekoppeld.",
      });
    }

    if (product.categories) {
      const categoryIds = product.categories.map((category) => category.categoryId);
      if (new Set(categoryIds).size !== categoryIds.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categories"],
          message: "Een categorie kan maar één keer worden gekoppeld.",
        });
      }
      const primaryCount = product.categories.filter((category) => category.isPrimary).length;
      if (product.categories.length > 0 && primaryCount !== 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categories"],
          message: "Precies één gekoppelde categorie moet primair zijn.",
        });
      }
    }

    if (new Set(product.recommendationIds).size !== product.recommendationIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendationIds"],
        message: "Een meepakker kan maar één keer worden gekozen.",
      });
    }
  });

export type ProductAdminInput = z.infer<typeof productAdminInputSchema>;
export type ProductTranslationInput = z.infer<typeof productTranslationInputSchema>;
export type ProductCategoryInput = z.infer<typeof productCategoryInputSchema>;
export type ProductNutritionInput = z.infer<typeof productNutritionInputSchema>;

export function getProductTranslations(input: ProductAdminInput): ProductTranslationInput[] {
  const translations = [...(input.translations ?? [])];
  if (!translations.some((translation) => translation.locale === "nl") && input.translation && input.slug) {
    translations.unshift({
      locale: "nl",
      slug: input.slug,
      name: input.translation.name,
      shortDescription: input.translation.shortDescription,
      description: input.translation.description,
      descriptionHtml: null,
      seoTitle: null,
      metaDescription: null,
      promotionText: null,
    });
  }
  return translations;
}

export function getProductCategories(input: ProductAdminInput): ProductCategoryInput[] {
  return input.categories ?? input.categoryIds.map((categoryId, index) => ({
    categoryId,
    isPrimary: index === 0,
    sortOrder: index,
  }));
}

export function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function slugifyProduct(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}
