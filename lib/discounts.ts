export const MARKET_DISCOUNT_CODES = ["marktactie10", "rubensmarkt"] as const;
export const MARKET_DISCOUNT_PERCENT = 10;

export type AppliedDiscount = {
  code: string;
  percent: number;
  discountCents: number;
};

export type FirstOrderDiscountEvaluation =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "ineligible" }
  | { status: "applied"; discount: AppliedDiscount };

function normalizeDiscountCode(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("nl-NL") ?? "";
}

export function calculateDiscount(
  subtotalCents: number,
  code: string | null | undefined
): AppliedDiscount | null {
  const normalizedCode = normalizeDiscountCode(code);
  const matchedCode = MARKET_DISCOUNT_CODES.find(
    (candidate) => normalizeDiscountCode(candidate) === normalizedCode
  );

  if (!matchedCode) {
    return null;
  }

  return {
    code: matchedCode,
    percent: MARKET_DISCOUNT_PERCENT,
    discountCents: Math.round((Math.max(0, subtotalCents) * MARKET_DISCOUNT_PERCENT) / 100),
  };
}

export function evaluateFirstOrderDiscount(
  subtotalCents: number,
  code: string | null | undefined,
  hasPreviousPaidOrder: boolean
): FirstOrderDiscountEvaluation {
  if (!hasDiscountCode(code)) {
    return { status: "none" };
  }

  const discount = calculateDiscount(subtotalCents, code);
  if (!discount) {
    return { status: "invalid" };
  }
  if (hasPreviousPaidOrder) {
    return { status: "ineligible" };
  }

  return { status: "applied", discount };
}

export function hasDiscountCode(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}
