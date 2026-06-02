import { getCart } from "../../lib/cart";
import { CartItem } from "../cart/CartItem";
import { CartTotals } from "../cart/CartTotals";

export async function OrderReview() {
  const cart = await getCart();

  return (
    <section className="product-list">
      {cart.items.map((item) => (
        <CartItem
          key={`${item.productId}-${item.variantId ?? "default"}-${item.weightId ?? "default"}`}
          item={item}
        />
      ))}

      <CartTotals cart={cart} />
    </section>
  );
}
