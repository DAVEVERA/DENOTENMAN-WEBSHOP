import type { CartItem } from "./calculate-cart";
import type { Cart } from "./create-cart";

function sameCartLine(left: CartItem, right: CartItem) {
  return left.productId === right.productId && (left.variantId ?? null) === (right.variantId ?? null);
}

export function addCartItem(cart: Cart, item: CartItem): Cart {
  const existing = cart.items.find((line) => sameCartLine(line, item));
  const items = existing
    ? cart.items.map((line) =>
        sameCartLine(line, item) ? { ...line, quantity: line.quantity + item.quantity } : line,
      )
    : [...cart.items, item];

  return {
    ...cart,
    items,
    updatedAt: new Date().toISOString(),
  };
}
