export type VariantPrice = {
  priceCents: number;
  regularPriceCents: number;
  salePriceCents: number | null;
};

export type ProductDisplayPrice = {
  priceCents: number;
  regularPriceCents: number;
  salePriceCents: number | null;
  hasVariablePrice: boolean;
};

export function resolveProductDisplayPrice(
  fallbackRegularPriceCents: number,
  fallbackSalePriceCents: number | null,
  variants: VariantPrice[]
): ProductDisplayPrice {
  if (variants.length === 0) {
    return {
      priceCents: fallbackSalePriceCents ?? fallbackRegularPriceCents,
      regularPriceCents: fallbackRegularPriceCents,
      salePriceCents: fallbackSalePriceCents,
      hasVariablePrice: false,
    };
  }

  const ordered = [...variants].sort(
    (left, right) =>
      left.priceCents - right.priceCents ||
      right.regularPriceCents - left.regularPriceCents
  );
  const lowest = ordered[0];

  return {
    priceCents: lowest.priceCents,
    regularPriceCents: lowest.regularPriceCents,
    salePriceCents: lowest.salePriceCents,
    hasVariablePrice: new Set(variants.map((variant) => variant.priceCents)).size > 1,
  };
}
