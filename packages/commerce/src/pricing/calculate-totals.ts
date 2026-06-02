import { calculateDiscountCents } from "./calculate-discount";
import { calculateLineSubtotalCents } from "./calculate-price";
import { calculateTaxCents } from "./calculate-tax";

export type TotalsLine = {
  unitPriceCents: number;
  quantity: number;
};

export type TotalsInput = {
  lines: TotalsLine[];
  shippingCents?: number;
  discountCents?: number;
  discountPercentage?: number;
  vatRate?: number;
};

export type CommerceTotals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

export function calculateTotals(input: TotalsInput): CommerceTotals {
  const subtotalCents = input.lines.reduce(
    (total, line) => total + calculateLineSubtotalCents(line),
    0,
  );
  const discountCents = calculateDiscountCents({
    subtotalCents,
    fixedDiscountCents: input.discountCents,
    percentage: input.discountPercentage,
  });
  const shippingCents = input.shippingCents ?? 0;
  const taxableCents = Math.max(0, subtotalCents - discountCents) + shippingCents;
  const taxCents = calculateTaxCents(taxableCents, input.vatRate ?? 0.09);

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}
