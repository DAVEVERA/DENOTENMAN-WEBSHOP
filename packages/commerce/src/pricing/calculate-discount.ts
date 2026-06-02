export type DiscountInput = {
  subtotalCents: number;
  fixedDiscountCents?: number;
  percentage?: number;
};

export function calculateDiscountCents(input: DiscountInput) {
  const fixed = input.fixedDiscountCents ?? 0;
  const percentage = input.percentage ?? 0;
  const percentageDiscount = Math.round(input.subtotalCents * percentage);
  const discount = Math.max(0, fixed + percentageDiscount);
  return Math.min(input.subtotalCents, discount);
}
