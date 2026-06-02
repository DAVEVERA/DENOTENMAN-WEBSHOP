import { formatCartPrice, type StorefrontCart } from "../../lib/cart";
import { Icon } from "../ui/Icon";

export function CartTotals({ cart }: { cart: StorefrontCart }) {
  return (
    <div className="invoice-panel">
      <div>
        <span>
          <Icon name="medium_bag" />
          Subtotaal
        </span>
        <strong>{formatCartPrice(cart.subtotalCents)}</strong>
      </div>

      <div>
        <span>
          <Icon name="truck_icon" />
          Verzending
        </span>
        <strong>{cart.shippingCents === 0 ? "Gratis" : formatCartPrice(cart.shippingCents)}</strong>
      </div>

      <div>
        <span>
          <Icon name="Mail" />
          Btw
        </span>
        <strong>{formatCartPrice(cart.taxCents)}</strong>
      </div>

      <div>
        <span>
          <Icon name="creditcard" />
          Totaal
        </span>
        <strong>{formatCartPrice(cart.totalCents)}</strong>
      </div>
    </div>
  );
}
