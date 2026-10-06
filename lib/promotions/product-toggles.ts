import "server-only";

import { cookies } from "next/headers";

import type { ProductPromotionToggle } from "@/components/admin-panel/promotions/ProductPromotionToggles";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ruleFromRow } from "./engine";

const KIND_LABELS = { PRICE: "Actieprijs", VOLUME: "Stapelkorting", LOYALTY: "Vaste klantenkorting", LABEL: "Label" } as const;
const STATUS_LABELS = { DRAFT: "Concept", ACTIVE: "Actief", PAUSED: "Gepauzeerd", ARCHIVED: "Gearchiveerd" } as const;

/** Every non-archived promotion with whether this product is in it, for the product page checkboxes. */
export async function productPromotionToggles(productId: string, categoryIds: string[]): Promise<{ promotions: ProductPromotionToggle[]; canEdit: boolean }> {
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  const [admin, rows, categories] = await Promise.all([
    session ? prisma.adminUser.findUnique({ where: { id: session.userId }, select: { role: true } }) : Promise.resolve(null),
    prisma.promotion.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ status: "asc" }, { priority: "desc" }] }),
    prisma.categoryTranslation.findMany({ where: { categoryId: { in: categoryIds }, locale: "nl" }, select: { categoryId: true, name: true } }),
  ]);
  const categoryName = new Map(categories.map((category) => [category.categoryId, category.name]));
  const promotions = rows.map((row): ProductPromotionToggle => {
    const rule = ruleFromRow(row);
    const excluded = row.excludedProductIds.includes(productId);
    const viaCategory = row.categoryIds.find((id) => categoryIds.includes(id));
    const included = row.scope === "PRODUCTS"
      ? row.productIds.includes(productId)
      : !excluded && (row.scope === "ALL" || Boolean(viaCategory));
    const reach = row.scope === "PRODUCTS"
      ? "gekozen producten"
      : row.scope === "ALL"
        ? excluded ? "alle producten, dit product uitgesloten" : "alle producten"
        : viaCategory ? `via categorie ${categoryName.get(viaCategory) ?? ""}${excluded ? ", dit product uitgesloten" : ""}` : "andere categorieën";
    return {
      id: row.id,
      name: row.name,
      kindLabel: KIND_LABELS[row.kind],
      statusLabel: STATUS_LABELS[row.status],
      included,
      reach,
      badge: {
        id: row.id, kind: rule.kind, text: rule.badge.text.nl, background: rule.badge.background, color: rule.badge.color,
        shape: rule.badge.shape, position: rule.badge.position, size: "sm", percentOff: null, countdownEndsAt: null,
        placements: { card: true, detail: true, cart: true },
      },
    };
  })
    // Category promotions for other categories cannot be switched on from here.
    .filter((promotion, index) => rows[index].scope !== "CATEGORIES" || promotion.reach !== "andere categorieën");
  return { promotions, canEdit: admin?.role === "OWNER" || admin?.role === "ADMIN" };
}
