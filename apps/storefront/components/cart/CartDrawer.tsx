import { getCart } from "../../lib/cart";
import { Drawer } from "../ui/Drawer";
import { CartItem } from "./CartItem";
import { CartTotals } from "./CartTotals";

export async function CartDrawer() {
  const cart = await getCart();

  return (
    <Drawer title="Winkelwagen">
      <div className="product-list">
        {cart.items.length === 0 ? <p>Je winkelwagen is nog leeg.</p> : null}
        {cart.items.map((item) => (
          <CartItem
            key={`${item.productId}-${item.variantId ?? "default"}-${item.weightId ?? "default"}`}
            item={item}
          />
        ))}
      </div>

      <CartTotals cart={cart} />

      <a href="/checkout" className="button button--primary">
        Naar de kassa
      </a>
    </Drawer>
  );
}
