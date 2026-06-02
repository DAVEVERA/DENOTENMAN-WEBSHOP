export type VolumeDiscountTier = {
  minQuantity: number;
  percentage: number;
};

export function calculateVolumeDiscount(quantity: number, tiers: VolumeDiscountTier[]) {
  const tier = [...tiers]
    .filter((entry) => quantity >= entry.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0];
  return tier?.percentage ?? 0;
}
