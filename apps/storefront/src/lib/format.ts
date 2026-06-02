export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatPricePer100g(priceCents: number, weightGrams: number): string {
  const pricePer100g = (priceCents / weightGrams) * 100;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(pricePer100g / 100);
}
