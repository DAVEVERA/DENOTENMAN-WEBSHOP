export function calculateTaxCents(amountExVatCents: number, vatRate: number) {
  if (!Number.isFinite(amountExVatCents) || amountExVatCents < 0) {
    throw new Error("Bedrag voor btw-berekening is ongeldig.");
  }
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new Error("Btw-percentage is ongeldig.");
  }
  return Math.round(amountExVatCents * vatRate);
}
