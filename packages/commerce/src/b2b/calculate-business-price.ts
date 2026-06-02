import { calculateVolumeDiscount, type VolumeDiscountTier } from "./calculate-volume-discount";

export function calculateBusinessPriceCents(
  unitPriceCents: number,
  quantity: number,
  tiers: VolumeDiscountTier[] = [],
) {
  const discount = calculateVolumeDiscount(quantity, tiers);
  return Math.round(unitPriceCents * (1 - discount));
}
