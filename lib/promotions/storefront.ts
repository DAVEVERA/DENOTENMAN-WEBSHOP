import "server-only";

import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { resolveProductDisplayPrice } from "@/lib/product-price";
import { isPromotionLive, productPromotionView, type BadgeView, type ProductPromotionView, type VariantFacts } from "./engine";
import { loadActivePromotionRules, productCategoryIds } from "./store";

// Adds labels, action prices and volume tiers to products on their way to the
// storefront. Prices here are for display; the checkout prices again on the server.

export type ProductPromotionDto = {
  badges: BadgeView[];
  volumeTiers: ProductPromotionView["volumeTiers"];
};

type StorefrontVariant = { id: string; priceCents: number; regularPriceCents: number; salePriceCents: number | null };

type StorefrontProduct = {
  id: string;
  basePriceCents: number;
  regularBasePriceCents: number;
  salePriceCents: number | null;
  hasVariablePrice: boolean;
  promotion?: ProductPromotionDto | null;
  variants?: StorefrontVariant[];
};

export async function withProductPromotions<T extends StorefrontProduct>(products: T[], locale: Locale, now = new Date()): Promise<T[]> {
  if (!products.length) return products;
  let rules;
  try {
    rules = (await loadActivePromotionRules()).filter((rule) => isPromotionLive(rule, now));
  } catch (error) {
    // A promotion problem must never take the shop down: show regular prices.
    console.error("Loading promotions failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return products;
  }
  if (!rules.length) return products;

  const ids = products.map((product) => product.id);
  const needsCreatedAt = rules.some((rule) => rule.kind === "LABEL" && rule.newWithinDays !== null);
  const needsVariants = products.some((product) => !product.variants) && rules.some((rule) => rule.kind === "PRICE");
  const [categories, created, variantRows] = await Promise.all([
    productCategoryIds(ids, rules),
    needsCreatedAt ? prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, createdAt: true } }) : Promise.resolve([]),
    needsVariants
      ? prisma.productVariant.findMany({ where: { productId: { in: ids }, isActive: true }, select: { id: true, productId: true, priceCents: true, salePriceCents: true } })
      : Promise.resolve([]),
  ]);
  const createdAt = new Map(created.map((row) => [row.id, row.createdAt]));
  const variantsByProduct = new Map<string, VariantFacts[]>();
  for (const row of variantRows) {
    const list = variantsByProduct.get(row.productId) ?? [];
    list.push({ variantId: row.id, regularCents: row.priceCents, saleCents: row.salePriceCents });
    variantsByProduct.set(row.productId, list);
  }

  return products.map((product) => {
    const variantFacts: VariantFacts[] = product.variants
      ? product.variants.map((variant) => ({ variantId: variant.id, regularCents: variant.regularPriceCents, saleCents: variant.salePriceCents }))
      : variantsByProduct.get(product.id) ?? [];
    const view = productPromotionView(
      rules,
      { productId: product.id, categoryIds: categories.get(product.id) ?? [], createdAt: createdAt.get(product.id) ?? null },
      variantFacts,
      now,
      locale,
    );
    const promotion = view.badges.length || view.volumeTiers.length ? { badges: view.badges, volumeTiers: view.volumeTiers } : null;
    if (!variantFacts.length) return { ...product, promotion } as T;

    const prices = variantFacts.map((variant) => {
      const price = view.variantPrices[variant.variantId];
      return {
        priceCents: price.unitCents,
        regularPriceCents: price.regularCents,
        salePriceCents: price.unitCents < price.regularCents ? price.unitCents : null,
      };
    });
    const display = resolveProductDisplayPrice(product.regularBasePriceCents, product.salePriceCents, prices);
    return {
      ...product,
      promotion,
      basePriceCents: display.priceCents,
      regularBasePriceCents: display.regularPriceCents,
      salePriceCents: display.salePriceCents,
      hasVariablePrice: display.hasVariablePrice,
      ...(product.variants
        ? {
            variants: product.variants.map((variant) => {
              const price = view.variantPrices[variant.id];
              return price
                ? { ...variant, priceCents: price.unitCents, salePriceCents: price.unitCents < price.regularCents ? price.unitCents : null }
                : variant;
            }),
          }
        : {}),
    } as T;
  });
}
