import { NextResponse } from "next/server";
import { evaluateCheckoutDiscount, resolveDiscountUsagePolicy } from "@/lib/discounts";
import { discountUsageAvailable } from "@/lib/discount-usage";
import { calculateShippingCents, isShippingCountryCode } from "@/lib/shipping";
import { prisma } from "@/lib/prisma";

type DiscountValidationBody = {
  code?: unknown;
  subtotalCents?: unknown;
  country?: unknown;
  totalWeightGrams?: unknown;
  deliveryMethod?: unknown;
  email?: unknown;
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
      minimumOrderCents: true,
      maximumDiscountCents: true,
      redemptionMode: true,
      identityScope: true,
      maxUsesPerIdentity: true,
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
    return NextResponse.json(
      { error: evaluation.status === "ineligible" ? "DISCOUNT_NOT_ELIGIBLE" : "INVALID_DISCOUNT_CODE" },
      { status: 422 }
    );
  }

  const submittedEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (!evaluation.isTest && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: submittedEmail, mode: "insensitive" } },
      select: { id: true },
    });
    const policy = resolveDiscountUsagePolicy(evaluation.discount.code, configuredDiscount);
    if (!await discountUsageAvailable(policy, { email: submittedEmail, userId: existingUser?.id ?? null })) {
      return NextResponse.json({ error: "DISCOUNT_NOT_ELIGIBLE" }, { status: 422 });
    }
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
