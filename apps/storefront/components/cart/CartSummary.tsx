import type { StorefrontCart } from "../../lib/cart";
import { Icon } from "../ui/Icon";
import { CartTotals } from "./CartTotals";

export function CartSummary({ cart }: { cart: StorefrontCart }) {
  return (
    <aside className="dashboard-card">
      <h2>Samenvatting</h2>
      <CartTotals cart={cart} />

      <a href={cart.items.length > 0 ? "/checkout" : "/winkel"} className="button button--primary">
        <Icon name={cart.items.length > 0 ? "checkout" : "medium_bag"} />
        {cart.items.length > 0 ? "Naar de kassa" : "Verder winkelen"}
      </a>
    </aside>
  );
}
