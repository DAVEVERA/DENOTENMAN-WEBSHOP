import { NextResponse } from "next/server";
import { z } from "zod";
import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n";
import { priceCartLines } from "@/lib/orders";
import { getShippingPolicy } from "@/lib/shipping";
import { proposeShippingAddons } from "@/lib/shipping-addons";
import { publicImageUrl } from "@/lib/storage";

const input = z.object({
  locale: z.string().refine(isLocale),
  country: z.enum(["NL", "BE"]),
  lines: z.array(z.object({ variantId: z.string().cuid(), quantity: z.number().int().min(1).max(100) })).min(1).max(30),
}).strict();
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyRequests(request: Request): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  if (attempts.size > 5000) attempts.clear();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 60_000 }); return false; }
  current.count += 1;
  return current.count > 30;
}

export async function POST(request: Request) {
  if (tooManyRequests(request)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const { country, lines } = parsed.data;
  const locale = parsed.data.locale as "nl" | "en" | "fr";
  try {
    const base = await priceCartLines(lines, locale, undefined, false, "SHIPPING", country);
    const threshold = getShippingPolicy(country).freeShippingThresholdCents;
    if (base.subtotalCents >= threshold) return NextResponse.json({ suggestions: [] });
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true }, ...(process.env.UNLIMITED_STOCK === "true" ? {} : { stock: { gt: 0 } }) },
      select: {
        id: true, sku: true, stock: true, weightGrams: true, priceCents: true, salePriceCents: true,
        translations: { where: { locale: { in: locale === "nl" ? ["nl"] : [locale, "nl"] } }, select: { locale: true, label: true } },
        product: {
          select: {
            id: true,
            translations: { where: { locale: { in: locale === "nl" ? ["nl"] : [locale, "nl"] } }, select: { locale: true, name: true, slug: true } },
            images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { storageKey: true } },
          },
        },
      },
      take: 500,
    });
    const proposals = proposeShippingAddons(
      base.subtotalCents,
      threshold,
      variants.map((variant) => ({ id: variant.id, priceCents: variant.salePriceCents ?? variant.priceCents, stock: process.env.UNLIMITED_STOCK === "true" ? 100 : variant.stock })),
      new Set(lines.map((line) => line.variantId)),
      20,
    );
    const limit = pLimit(4);
    const checked = await Promise.all(proposals.map((proposal) => limit(async () => {
      const variant = variants.find((item) => item.id === proposal.id)!;
      try {
        const priced = await priceCartLines([...lines, { variantId: variant.id, quantity: proposal.quantity }], locale, undefined, false, "SHIPPING", country);
        if (priced.subtotalCents < threshold || priced.shippingCents !== 0) return null;
        const overageCents = priced.subtotalCents - threshold;
        if (overageCents > Math.min(1000, Math.round(threshold * 0.2))) return null;
        const translation = variant.product.translations.find((item) => item.locale === locale) ?? variant.product.translations.find((item) => item.locale === "nl");
        const variantTranslation = variant.translations.find((item) => item.locale === locale) ?? variant.translations.find((item) => item.locale === "nl");
        const line = priced.lines.find((item) => item.variantId === variant.id);
        if (!translation || !line) return null;
        return {
          variantId: variant.id, productId: variant.product.id, slug: translation.slug, name: translation.name,
          variantLabel: variantTranslation?.label ?? variant.sku, weightGrams: variant.weightGrams,
          priceCents: line.unitPriceCents, quantity: proposal.quantity, overageCents,
          imageUrl: variant.product.images[0] ? publicImageUrl(variant.product.images[0].storageKey) : null,
        };
      } catch { return null; }
    })));
    return NextResponse.json({ suggestions: checked.filter((item) => item !== null).sort((left, right) => left.overageCents - right.overageCents).slice(0, 10) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Shipping add-on suggestions failed", { country, error });
    return NextResponse.json({ error: "SUGGESTIONS_UNAVAILABLE" }, { status: 409 });
  }
}
