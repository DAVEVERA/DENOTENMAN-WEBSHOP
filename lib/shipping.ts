export const SHIPPING_COUNTRY_CODES = ["NL", "BE"] as const;
export type ShippingCountryCode = (typeof SHIPPING_COUNTRY_CODES)[number];

export type ShippingRateTier = {
  maxWeightGrams: number | null;
  rateCents: number;
};

export type ShippingPolicy = {
  freeShippingThresholdCents: number;
  rateTiers: readonly ShippingRateTier[];
};

export const SHIPPING_POLICIES = {
  NL: {
    freeShippingThresholdCents: 5_000,
    rateTiers: [
      { maxWeightGrams: 3_000, rateCents: 595 },
      // The supplied second band is advertised through 10 kg. Keeping this
      // final tier open-ended prevents an unpriced heavier cart; ordinary
      // heavier NL carts already qualify for free shipping from EUR 50.
      { maxWeightGrams: null, rateCents: 695 },
    ],
  },
  BE: {
    freeShippingThresholdCents: 7_000,
    rateTiers: [
      { maxWeightGrams: 2_000, rateCents: 665 },
      { maxWeightGrams: null, rateCents: 875 },
    ],
  },
} as const satisfies Record<ShippingCountryCode, ShippingPolicy>;

export type ShippingCalculation = {
  country: ShippingCountryCode;
  subtotalCents: number;
  totalWeightGrams: number | null;
  deliveryMethod?: "SHIPPING" | "PICKUP";
};

export type ShippingWeightLine = {
  quantity: number;
  weightGrams: number;
};

export function isShippingCountryCode(value: string): value is ShippingCountryCode {
  return SHIPPING_COUNTRY_CODES.some((country) => country === value);
}

export function getShippingPolicy(country: ShippingCountryCode): ShippingPolicy {
  return SHIPPING_POLICIES[country];
}

export function calculateTotalWeightGrams(lines: readonly ShippingWeightLine[]): number | null {
  let totalWeightGrams = 0;

  for (const line of lines) {
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isSafeInteger(line.weightGrams) ||
      line.weightGrams <= 0
    ) {
      return null;
    }
    totalWeightGrams += line.quantity * line.weightGrams;
  }

  return Number.isSafeInteger(totalWeightGrams) && totalWeightGrams > 0
    ? totalWeightGrams
    : null;
}

export function shippingRateForWeight(
  country: ShippingCountryCode,
  totalWeightGrams: number | null
): number {
  const policy = getShippingPolicy(country);
  const hasValidWeight =
    typeof totalWeightGrams === "number" &&
    Number.isSafeInteger(totalWeightGrams) &&
    totalWeightGrams > 0;

  if (!hasValidWeight) {
    // Missing legacy browser-cart weights must never cause undercharging. The
    // server uses database weights and will still persist the exact rate.
    return Math.max(...policy.rateTiers.map((tier) => tier.rateCents));
  }

  return (
    policy.rateTiers.find(
      (tier) => tier.maxWeightGrams === null || totalWeightGrams <= tier.maxWeightGrams
    ) ?? policy.rateTiers[policy.rateTiers.length - 1]
  ).rateCents;
}

export function calculateShippingCents({
  country,
  subtotalCents,
  totalWeightGrams,
  deliveryMethod = "SHIPPING",
}: ShippingCalculation): number {
  if (deliveryMethod === "PICKUP" || subtotalCents === 0) return 0;

  const policy = getShippingPolicy(country);
  if (subtotalCents >= policy.freeShippingThresholdCents) return 0;

  return shippingRateForWeight(country, totalWeightGrams);
}

export const STANDARD_HANDLING_DAYS = { min: 0, max: 1 } as const;
export const STANDARD_TRANSIT_DAYS = { min: 1, max: 2 } as const;
export const SHIPPING_BUSINESS_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export const RETURN_WINDOW_DAYS = 14;
export const RETURN_COUNTRY_CODES = SHIPPING_COUNTRY_CODES;
export const RETURN_POLICY_COUNTRY = "NL" as const;

export function postnlTrackingUrl(trackingCode: string, postalCode: string, country: string): string {
  return `https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(trackingCode)}-${encodeURIComponent(country)}-${encodeURIComponent(postalCode.replace(/\s+/g, ""))}`;
}
