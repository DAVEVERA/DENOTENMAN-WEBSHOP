export type CartItemInput = {
  productId: number;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
};

export function validateCartItemInput(input: CartItemInput) {
  if (!Number.isInteger(input.productId) || input.productId <= 0) {
    throw new Error("Product-id is ongeldig.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Aantal moet minimaal 1 zijn.");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    throw new Error("Prijs is ongeldig.");
  }
  return input;
}
