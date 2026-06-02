import type { Cart } from "./create-cart";

export function removeCartItem(cart: Cart, productId: number, variantId: string | null = null): Cart {
  return {
    ...cart,
    items: cart.items.filter(
      (item) => !(item.productId === productId && (item.variantId ?? null) === variantId),
    ),
    updatedAt: new Date().toISOString(),
  };
}
