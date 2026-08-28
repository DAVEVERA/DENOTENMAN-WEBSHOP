import { NextResponse } from "next/server";
import { evaluateCheckoutDiscount } from "@/lib/discounts";
import { calculateShippingCents, isShippingCountryCode } from "@/lib/shipping";
import { prisma } from "@/lib/prisma";

type DiscountValidationBody = {
  code?: unknown;
  subtotalCents?: unknown;
  country?: unknown;
  totalWeightGrams?: unknown;
  deliveryMethod?: unknown;
};

export async function POST(request: Request) {
  let body: DiscountValidationBody;
  try {
    body = (await request.json()) as DiscountValidationBody;
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (
    typeof body.code !== "string" ||
    typeof body.subtotalCents !== "number" ||
    !Number.isSafeInteger(body.subtotalCents) ||
    body.subtotalCents < 0 ||
    body.subtotalCents > 100_000_000
  ) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  // This subtotal only powers the checkout preview. createOrderWithPayment
  // always recalculates every price from the database before saving an order.
  const configuredDiscount = await prisma.discount.findUnique({
    where: { code: body.code.trim().toUpperCase() },
    select: {
      code: true,
      status: true,
      percentOff: true,
      amountOffCents: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const evaluation = evaluateCheckoutDiscount(
    body.subtotalCents,
    body.code,
    false,
    process.env.TEST_ORDER_DISCOUNT_CODE,
    configuredDiscount
  );

  if (evaluation.status !== "applied") {
    return NextResponse.json({ error: "INVALID_DISCOUNT_CODE" }, { status: 422 });
  }

  const country =
    typeof body.country === "string" && isShippingCountryCode(body.country)
      ? body.country
      : "NL";
  const totalWeightGrams =
    typeof body.totalWeightGrams === "number" &&
    Number.isSafeInteger(body.totalWeightGrams) &&
    body.totalWeightGrams > 0
      ? body.totalWeightGrams
      : null;
  const deliveryMethod = body.deliveryMethod === "PICKUP" ? "PICKUP" : "SHIPPING";
  const regularShippingCents = calculateShippingCents({
    country,
    subtotalCents: body.subtotalCents,
    totalWeightGrams,
    deliveryMethod,
  });
  const shippingCents = evaluation.isTest ? 0 : regularShippingCents;

  return NextResponse.json({
    code: evaluation.discount.code,
    discountCents: evaluation.discount.discountCents,
    shippingCents,
    totalCents: body.subtotalCents - evaluation.discount.discountCents + shippingCents,
    isTest: evaluation.isTest,
  });
}
