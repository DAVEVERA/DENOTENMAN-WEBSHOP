import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { Prisma, type AdminUser, type Promotion } from "@prisma/client";

import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { prisma } from "@/lib/prisma";
import type { PromotionInput } from "./schema";
import { clearPromotionCache } from "./store";

// Admin side of product promotions: guard, persistence and audit. Promotions change
// what customers pay, so changing them is limited to owners and admins.

export function promotionJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function requirePromotionAdmin(request: NextRequest, options: { write?: boolean } = {}) {
  const admin = await getAdminSession(request);
  if (!admin) return { response: promotionJson({ error: "UNAUTHORIZED", message: "Log opnieuw in." }, 401) };
  if (options.write) {
    if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
      return { response: promotionJson({ error: "FORBIDDEN", message: "Alleen een owner of admin kan acties en prijzen wijzigen." }, 403) };
    }
    if (!isSameOriginMutation(request)) return { response: promotionJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403) };
  }
  return { admin };
}

function toData(input: PromotionInput) {
  const price = input.kind === "PRICE";
  return {
    name: input.name,
    kind: input.kind,
    status: input.status,
    priority: input.priority,
    discountType: price ? input.discountType : null,
    discountValue: price || input.kind === "LOYALTY" ? input.discountValue : null,
    variantPrices: price && input.discountType === "FIXED_PRICE" && input.variantPrices && Object.keys(input.variantPrices).length
      ? (input.variantPrices as Prisma.InputJsonValue)
      : undefined,
    volumeTiers: input.kind === "VOLUME" && input.volumeTiers ? (input.volumeTiers as unknown as Prisma.InputJsonValue) : undefined,
    volumeScope: input.kind === "VOLUME" ? input.volumeScope ?? "LINE" : null,
    loyaltyMinOrders: input.kind === "LOYALTY" ? input.loyaltyMinOrders : null,
    newWithinDays: input.kind === "LABEL" ? input.newWithinDays : null,
    stackWithVolume: input.stackWithVolume,
    allowDiscountCodes: input.allowDiscountCodes,
    scope: input.scope,
    productIds: input.scope === "PRODUCTS" ? [...new Set(input.productIds)] : [],
    categoryIds: input.scope === "CATEGORIES" ? [...new Set(input.categoryIds)] : [],
    excludedProductIds: input.scope === "PRODUCTS" ? [] : [...new Set(input.excludedProductIds)],
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    weekdays: [...new Set(input.weekdays)].sort(),
    dailyStartMinute: input.dailyStartMinute,
    dailyEndMinute: input.dailyEndMinute,
    badge: input.badge as unknown as Prisma.InputJsonValue,
  };
}

export async function createPromotion(admin: AdminUser, input: PromotionInput): Promise<Promotion> {
  const created = await prisma.$transaction(async (tx) => {
    const promotion = await tx.promotion.create({ data: { ...toData(input), createdByAdminId: admin.id } });
    await recordAudit(tx, admin, "Promotion", promotion.id, "CREATE", null, promotion);
    return promotion;
  });
  clearPromotionCache();
  return created;
}

export async function updatePromotion(admin: AdminUser, id: string, input: PromotionInput): Promise<Promotion | null> {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.promotion.findUnique({ where: { id } });
    if (!before) return null;
    const data = toData(input);
    const promotion = await tx.promotion.update({
      where: { id },
      // Json columns are cleared explicitly when the kind no longer uses them.
      data: { ...data, variantPrices: data.variantPrices ?? Prisma.DbNull, volumeTiers: data.volumeTiers ?? Prisma.DbNull },
    });
    await recordAudit(tx, admin, "Promotion", id, "UPDATE", before, promotion);
    return promotion;
  });
  clearPromotionCache();
  return updated;
}

export async function deletePromotion(admin: AdminUser, id: string): Promise<boolean> {
  const deleted = await prisma.$transaction(async (tx) => {
    const before = await tx.promotion.findUnique({ where: { id } });
    if (!before) return false;
    await tx.promotion.delete({ where: { id } });
    await recordAudit(tx, admin, "Promotion", id, "DELETE", before, null);
    return true;
  });
  clearPromotionCache();
  return deleted;
}

/** The product page checkbox: adds or removes one product from a promotion that targets products. */
export async function setPromotionProduct(admin: AdminUser, id: string, productId: string, included: boolean): Promise<Promotion | null> {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.promotion.findUnique({ where: { id } });
    if (!before) return null;
    let data: Prisma.PromotionUpdateInput;
    if (before.scope === "PRODUCTS") {
      const productIds = included ? [...new Set([...before.productIds, productId])] : before.productIds.filter((other) => other !== productId);
      data = { productIds };
    } else {
      // For "all products" or categories the checkbox works through the exclusion list.
      const excludedProductIds = included ? before.excludedProductIds.filter((other) => other !== productId) : [...new Set([...before.excludedProductIds, productId])];
      data = { excludedProductIds };
    }
    const promotion = await tx.promotion.update({ where: { id }, data });
    await recordAudit(tx, admin, "Promotion", id, "UPDATE", before, promotion);
    return promotion;
  });
  clearPromotionCache();
  return updated;
}

