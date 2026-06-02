import type { Cart } from "./create-cart";

export function updateCartItemQuantity(
  cart: Cart,
  productId: number,
  variantId: string | null,
  quantity: number,
): Cart {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Aantal is ongeldig.");
  }

  return {
    ...cart,
    items: cart.items
      .map((item) =>
        item.productId === productId && (item.variantId ?? null) === variantId
          ? { ...item, quantity }
          : item,
      )
      .filter((item) => item.quantity > 0),
    updatedAt: new Date().toISOString(),
  };
}
