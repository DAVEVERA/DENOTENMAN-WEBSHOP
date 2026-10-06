import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isLocale } from "@/lib/i18n";
import { CheckoutError, priceCartLines, type CartLineInput } from "@/lib/orders";
import { isPromotionLive } from "@/lib/promotions/engine";
import { loadActivePromotionRules } from "@/lib/promotions/store";
import { isShippingCountryCode } from "@/lib/shipping";

// What the checkout will charge, computed like POST /api/checkout but without creating
// an order: action prices, volume tiers, code and shipping. The loyalty discount is left
// out on purpose: it depends on an email address, and showing it here would let anyone
// find out whether an address belongs to a customer. It is applied when the order is
// placed, so the paid amount can only be lower than this quote, never higher.

const lineSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(999),
  productSlug: z.string().max(200).optional(),
  variantLabel: z.string().max(200).optional(),
}).strip();

const bodySchema = z.object({
  locale: z.string(),
  lines: z.array(lineSchema).min(1).max(100),
  discountCode: z.string().trim().max(64).optional(),
  deliveryMethod: z.enum(["SHIPPING", "PICKUP"]).default("SHIPPING"),
  country: z.string().max(4).default("NL"),
}).strip();

const noStore = { "cache-control": "no-store" };

async function loyaltyAvailable(): Promise<boolean> {
  const now = new Date();
  return (await loadActivePromotionRules()).some((rule) => rule.kind === "LOYALTY" && isPromotionLive(rule, now));
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isLocale(parsed.data.locale)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStore });
  }
  const { locale, lines, discountCode, deliveryMethod, country } = parsed.data;
  const cartLines: CartLineInput[] = lines;
  const shippingCountry = isShippingCountryCode(country) ? country : "NL";

  const quote = (code: string | undefined) =>
    priceCartLines(cartLines, locale, code, false, deliveryMethod, shippingCountry, { email: null });

  try {
    let discountError: string | null = null;
    let result;
    try {
      result = await quote(discountCode || undefined);
    } catch (error) {
      if (!(error instanceof CheckoutError) || (error.code !== "INVALID_DISCOUNT_CODE" && error.code !== "DISCOUNT_NOT_ELIGIBLE")) throw error;
      discountError = error.code;
      result = await quote(undefined);
    }
    return NextResponse.json({
      lines: result.lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        regularUnitPriceCents: line.regularUnitPriceCents,
        promotionLabel: line.promotionLabel,
      })),
      subtotalCents: result.subtotalCents,
      discountCode: result.discountCode,
      discountCents: result.discountCents,
      discountError,
      shippingCents: result.shippingCents,
      totalCents: result.totalCents,
      loyaltyAvailable: await loyaltyAvailable(),
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.code }, { status: 422, headers: noStore });
    }
    console.error("Checkout quote failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "QUOTE_FAILED" }, { status: 500, headers: noStore });
  }
}
