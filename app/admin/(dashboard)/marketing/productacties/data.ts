import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Promotion } from "@prisma/client";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BADGE, promotionBadgeSchema, variantPricesSchema, volumeTiersSchema, type PromotionInput } from "@/lib/promotions/schema";
import { publicImageUrl } from "@/lib/storage";
import type { PromotionEditorCategory, PromotionEditorProduct } from "@/components/admin-panel/promotions/PromotionEditor";

/** The signed-in admin and whether they may change promotions. */
export async function promotionAdmin() {
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({ where: { id: session.userId }, select: { role: true, active: true } });
  if (!admin?.active) redirect("/admin/login");
  return { canEdit: admin.role === "OWNER" || admin.role === "ADMIN" };
}

export async function promotionEditorOptions(): Promise<{ products: PromotionEditorProduct[]; categories: PromotionEditorCategory[] }> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        translations: { where: { locale: "nl" }, select: { name: true }, take: 1 },
        images: { select: { storageKey: true, isPrimary: true, sortOrder: true }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        variants: {
          where: { isActive: true },
          select: { id: true, priceCents: true, sku: true, weightGrams: true, translations: { where: { locale: "nl" }, select: { label: true }, take: 1 } },
          orderBy: { weightGrams: "asc" },
        },
      },
      orderBy: { slug: "asc" },
      take: 1_000,
    }),
    prisma.category.findMany({
      select: { id: true, slug: true, translations: { where: { locale: "nl" }, select: { name: true }, take: 1 } },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    }),
  ]);
  return {
    products: products
      .map((product) => ({
        id: product.id,
        name: product.translations[0]?.name ?? product.slug,
        imageUrl: product.images[0] ? publicImageUrl(product.images[0].storageKey) : null,
        variants: product.variants.map((variant) => ({ id: variant.id, label: variant.translations[0]?.label ?? variant.sku, priceCents: variant.priceCents })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    categories: categories.map((category) => ({ id: category.id, name: category.translations[0]?.name ?? category.slug })),
  };
}

/** A stored promotion as editor input; broken JSON falls back to defaults. */
export function promotionToInput(promotion: Promotion): PromotionInput {
  const badge = promotionBadgeSchema.safeParse(promotion.badge);
  const tiers = volumeTiersSchema.safeParse(promotion.volumeTiers);
  const prices = variantPricesSchema.safeParse(promotion.variantPrices ?? {});
  return {
    name: promotion.name,
    kind: promotion.kind,
    status: promotion.status,
    priority: promotion.priority,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    variantPrices: prices.success && Object.keys(prices.data).length ? prices.data : null,
    volumeTiers: tiers.success ? tiers.data : null,
    volumeScope: promotion.volumeScope,
    loyaltyMinOrders: promotion.loyaltyMinOrders,
    newWithinDays: promotion.newWithinDays,
    stackWithVolume: promotion.stackWithVolume,
    allowDiscountCodes: promotion.allowDiscountCodes,
    scope: promotion.scope,
    productIds: promotion.productIds,
    categoryIds: promotion.categoryIds,
    excludedProductIds: promotion.excludedProductIds,
    startsAt: promotion.startsAt?.toISOString() ?? null,
    endsAt: promotion.endsAt?.toISOString() ?? null,
    weekdays: promotion.weekdays,
    dailyStartMinute: promotion.dailyStartMinute,
    dailyEndMinute: promotion.dailyEndMinute,
    badge: badge.success ? badge.data : DEFAULT_BADGE,
  };
}
