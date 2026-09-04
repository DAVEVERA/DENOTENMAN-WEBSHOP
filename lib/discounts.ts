export const MARKET_DISCOUNT_CODES = ["marktactie10", "rubensmarkt"] as const;
export const MARKET_DISCOUNT_PERCENT = 10;

export type AppliedDiscount = {
  code: string;
  percent?: number;
  amountOffCents?: number;
  discountCents: number;
};

export type ConfiguredDiscount = {
  code: string;
  status: "DRAFT" | "ACTIVE" | "SCHEDULED" | "EXPIRED";
  percentOff: number | null;
  amountOffCents: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  minimumOrderCents?: number;
  maximumDiscountCents?: number | null;
  redemptionMode?: "SINGLE_USE" | "MULTIPLE_USE";
  identityScope?: "EMAIL" | "CUSTOMER" | "EMAIL_AND_CUSTOMER";
  maxUsesPerIdentity?: number | null;
};

export type DiscountUsagePolicy = {
  code: string;
  identityScope: "EMAIL" | "CUSTOMER" | "EMAIL_AND_CUSTOMER";
  maxUsesPerIdentity: number | null;
};

export type FirstOrderDiscountEvaluation =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "ineligible" }
  | { status: "applied"; discount: AppliedDiscount };

export type CheckoutDiscountEvaluation =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "ineligible" }
  | { status: "applied"; discount: AppliedDiscount; isTest: boolean };

export function normalizeDiscountCode(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("nl-NL") ?? "";
}

export function calculateConfiguredDiscount(
  subtotalCents: number,
  code: string | null | undefined,
  configured: ConfiguredDiscount | null | undefined,
  now = new Date()
): AppliedDiscount | null {
  if (!configured || normalizeDiscountCode(configured.code) !== normalizeDiscountCode(code)) {
    return null;
  }

  const hasStarted = !configured.startsAt || configured.startsAt.getTime() <= now.getTime();
  const hasNotEnded = !configured.endsAt || configured.endsAt.getTime() >= now.getTime();
  const activeByStatus =
    configured.status === "ACTIVE" ||
    (configured.status === "SCHEDULED" && Boolean(configured.startsAt) && hasStarted);
  if (!activeByStatus || !hasStarted || !hasNotEnded) return null;

  const safeSubtotal = Math.max(0, subtotalCents);
  if (safeSubtotal < (configured.minimumOrderCents ?? 0)) return null;
  if (configured.percentOff !== null) {
    const calculated = Math.round((safeSubtotal * configured.percentOff) / 100);
    return {
      code: configured.code,
      percent: configured.percentOff,
      discountCents: Math.min(safeSubtotal, configured.maximumDiscountCents ?? calculated, calculated),
    };
  }
  if (configured.amountOffCents !== null) {
    return {
      code: configured.code,
      amountOffCents: configured.amountOffCents,
      discountCents: Math.min(safeSubtotal, configured.amountOffCents),
    };
  }

  return null;
}

export function resolveDiscountUsagePolicy(
  code: string,
  configured?: ConfiguredDiscount | null
): DiscountUsagePolicy {
  if (!configured) {
    return { code, identityScope: "EMAIL", maxUsesPerIdentity: 1 };
  }
  return {
    code: configured.code,
    identityScope: configured.identityScope ?? "EMAIL",
    maxUsesPerIdentity:
      configured.redemptionMode === "MULTIPLE_USE"
        ? configured.maxUsesPerIdentity ?? null
        : 1,
  };
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

/**
 * Evaluates every checkout code server-side. The configured test code is an
 * argument on purpose: its value comes from a runtime secret and is never
 * embedded in the browser bundle.
 */
export function evaluateCheckoutDiscount(
  subtotalCents: number,
  code: string | null | undefined,
  hasPreviousPaidOrder: boolean,
  configuredTestCode: string | null | undefined,
  configuredDiscount?: ConfiguredDiscount | null,
  now = new Date()
): CheckoutDiscountEvaluation {
  const submittedCode = code?.trim() ?? "";
  const testCode = configuredTestCode?.trim() ?? "";

  if (!submittedCode) {
    return { status: "none" };
  }

  if (testCode && submittedCode === testCode) {
    return {
      status: "applied",
      discount: {
        code: testCode,
        percent: 100,
        discountCents: Math.max(0, subtotalCents),
      },
      isTest: true,
    };
  }

  if (configuredDiscount) {
    if (subtotalCents < (configuredDiscount.minimumOrderCents ?? 0)) {
      return { status: "ineligible" };
    }
    const discount = calculateConfiguredDiscount(
      subtotalCents,
      submittedCode,
      configuredDiscount,
      now
    );
    return discount
      ? { status: "applied", discount, isTest: false }
      : { status: "invalid" };
  }

  const marketEvaluation = evaluateFirstOrderDiscount(
    subtotalCents,
    submittedCode,
    hasPreviousPaidOrder
  );

  if (marketEvaluation.status !== "applied") {
    return marketEvaluation;
  }

  return { ...marketEvaluation, isTest: false };
}

export function resolvePaymentDisposition(
  isTest: boolean,
  totalCents: number
): "TEST_COMPLETE" | "MOLLIE" {
  return isTest && totalCents === 0 ? "TEST_COMPLETE" : "MOLLIE";
}

export function hasDiscountCode(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}
