import { z } from "zod";

const optionalSalePrice = z.number().int().nonnegative().nullable();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export const productAdminInputSchema = z
  .object({
    version: z.string().datetime().optional(),
    sku: z.string().trim().min(1).max(80),
    slug: z.string().trim().min(2).max(160).regex(slugPattern),
    basePriceCents: z.number().int().nonnegative(),
    salePriceCents: optionalSalePrice,
    unit: z.enum(["WEIGHT", "VOLUME"]),
    isActive: z.boolean(),
    translation: z.object({
      name: z.string().trim().min(1).max(180),
      shortDescription: z.string().trim().max(220).nullable(),
      description: z.string().trim().max(20000).nullable(),
    }),
    categoryIds: z.array(z.string().cuid()).max(2),
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

    if (new Set(product.recommendationIds).size !== product.recommendationIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendationIds"],
        message: "Een meepakker kan maar één keer worden gekozen.",
      });
    }
  });

export type ProductAdminInput = z.infer<typeof productAdminInputSchema>;

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
