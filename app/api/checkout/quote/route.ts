import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isLocale } from "@/lib/i18n";
import { CheckoutError, priceCartLines, type CartLineInput } from "@/lib/orders";
import { isShippingCountryCode } from "@/lib/shipping";

// What the checkout will charge, computed exactly like POST /api/checkout but without
// creating an order: action prices, volume tiers, loyalty discount, code and shipping.
// The checkout page shows these numbers so they always match the Mollie amount.

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
  email: z.string().trim().max(254).optional(),
}).strip();

const noStore = { "cache-control": "no-store" };

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isLocale(parsed.data.locale)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStore });
  }
  const { locale, lines, discountCode, deliveryMethod, country, email } = parsed.data;
  const cartLines: CartLineInput[] = lines;
  const shippingCountry = isShippingCountryCode(country) ? country : "NL";

  const quote = (code: string | undefined) =>
    priceCartLines(cartLines, locale, code, false, deliveryMethod, shippingCountry, { email: email || null });

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
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.code }, { status: 422, headers: noStore });
    }
    console.error("Checkout quote failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "QUOTE_FAILED" }, { status: 500, headers: noStore });
  }
}
