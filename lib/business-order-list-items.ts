import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateBusinessOrderListTotal } from "@/lib/business-portal-contract";

export const businessOrderListItemInputSchema = z.union([
  z.object({
    variantId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(100_000),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
  }).strict(),
  z.object({
    productName: z.string().trim().min(1).max(200),
    unit: z.string().trim().max(60).nullable().optional(),
    sku: z.string().trim().max(100).nullable().optional(),
    quantity: z.number().int().min(1).max(100_000),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
  }).strict(),
]);

export type BusinessOrderListItemInput = z.infer<typeof businessOrderListItemInputSchema>;

export type ResolvedBusinessOrderListItem = {
  productVariantId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
};

export type ResolveBusinessOrderListItemsResult =
  | { ok: true; items: ResolvedBusinessOrderListItem[]; totalCents: number }
  | { ok: false; error: "DUPLICATE_VARIANT" | "VARIANT_NOT_AVAILABLE" | "TOTAL_OUT_OF_RANGE" };

/** Shared by the order-list create route and the order-list items edit route. */
export async function resolveBusinessOrderListItems(
  inputItems: readonly BusinessOrderListItemInput[]
): Promise<ResolveBusinessOrderListItemsResult> {
  const variantIds = inputItems
    .filter((item): item is Extract<BusinessOrderListItemInput, { variantId: string }> => "variantId" in item)
    .map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    return { ok: false, error: "DUPLICATE_VARIANT" };
  }

  const variants = variantIds.length > 0
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true, product: { isActive: true } },
        include: {
          product: { select: { translations: { where: { locale: "nl" }, select: { name: true } } } },
          translations: { where: { locale: "nl" }, select: { label: true } },
        },
      })
    : [];
  if (variants.length !== variantIds.length) {
    return { ok: false, error: "VARIANT_NOT_AVAILABLE" };
  }
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  try {
    const totalCents = calculateBusinessOrderListTotal(inputItems);
    const items: ResolvedBusinessOrderListItem[] = inputItems.map((item) => {
      if ("variantId" in item) {
        const variant = variantById.get(item.variantId)!;
        return {
          productVariantId: variant.id,
          productName: variant.product.translations[0]?.name ?? variant.sku,
          variantLabel: variant.translations[0]?.label ?? `${variant.weightGrams} gram`,
          sku: variant.sku,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        };
      }
      return {
        productVariantId: null,
        productName: item.productName,
        variantLabel: item.unit?.trim() ? item.unit.trim() : null,
        sku: item.sku?.trim() ? item.sku.trim() : null,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      };
    });
    return { ok: true, items, totalCents };
  } catch {
    return { ok: false, error: "TOTAL_OUT_OF_RANGE" };
  }
}
