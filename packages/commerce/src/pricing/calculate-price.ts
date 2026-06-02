export type PriceInput = {
  unitPriceCents: number;
  quantity: number;
};

export function calculateLineSubtotalCents(input: PriceInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Aantal moet minimaal 1 zijn.");
  }
  if (!Number.isFinite(input.unitPriceCents) || input.unitPriceCents < 0) {
    throw new Error("Stukprijs is ongeldig.");
  }
  return Math.round(input.unitPriceCents * input.quantity);
}

export function eurosToCents(value: number) {
  return Math.round(value * 100);
}

export function centsToEuros(value: number) {
  return value / 100;
}
