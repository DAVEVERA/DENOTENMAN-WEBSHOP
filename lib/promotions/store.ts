import "server-only";

import { prisma } from "@/lib/prisma";
import { ruleFromRow, type PromotionRule } from "./engine";

// Active promotions, cached briefly per instance. Whether a promotion runs right now
// (dates, weekdays, time window) is decided by the engine at the moment of use, so
// the cache never makes a promotion start or stop late; it only delays admin edits.

const CACHE_MS = 30_000;
let cache: { rules: PromotionRule[]; loadedAt: number } | null = null;

export async function loadActivePromotionRules(): Promise<PromotionRule[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) return cache.rules;
  const rows = await prisma.promotion.findMany({
    where: { status: "ACTIVE", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  const rules = rows.map((row) => ruleFromRow(row));
  cache = { rules, loadedAt: Date.now() };
  return rules;
}

/** Call after an admin change so this instance shows it at once. */
export function clearPromotionCache(): void {
  cache = null;
}

/** Category ids per product, only fetched when a live rule targets categories. */
export async function productCategoryIds(productIds: string[], rules: PromotionRule[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(productIds.map((id) => [id, []]));
  if (!productIds.length || !rules.some((rule) => rule.scope === "CATEGORIES")) return result;
  const links = await prisma.productCategory.findMany({
    where: { productId: { in: [...new Set(productIds)] } },
    select: { productId: true, categoryId: true },
  });
  for (const link of links) result.get(link.productId)?.push(link.categoryId);
  return result;
}

/** Paid, non-test orders for an email address, for loyalty discounts. */
export async function paidOrderCount(email: string | null | undefined): Promise<number | null> {
  const normalized = email?.trim().toLocaleLowerCase("nl-NL");
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) return null;
  return prisma.order.count({
    where: {
      contactEmail: { equals: normalized, mode: "insensitive" },
      isTest: false,
      paidAt: { not: null },
      status: { in: ["PAID", "FULFILLED"] },
    },
  });
}
