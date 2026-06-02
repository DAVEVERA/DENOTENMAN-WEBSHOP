import {
  removeCartItemAction,
  updateCartItemAction,
} from "../../actions/cart.actions";
import { formatCartPrice, type StorefrontCartItem } from "../../lib/cart";
import { Icon } from "../ui/Icon";

type CartItemProps = {
  item: StorefrontCartItem;
};

export function CartItem({ item }: CartItemProps) {
  return (
    <article className="product-row">
      <div>
        <h2>{item.name}</h2>
        <p>
          {item.quantity} x {item.weightLabel ?? "stuk"} - {formatCartPrice(item.unitPriceCents)}
        </p>
      </div>

      <strong>{formatCartPrice(item.unitPriceCents * item.quantity)}</strong>

      <form action={updateCartItemAction} className="cart-inline-form">
        <input type="hidden" name="productId" value={item.productId} />
        <input type="hidden" name="variantId" value={item.variantId ?? ""} />
        <input type="hidden" name="weightId" value={item.weightId ?? ""} />
        <input type="number" name="quantity" min={0} defaultValue={item.quantity} aria-label="Aantal" />
        <button className="button button--secondary" type="submit">
          <Icon name="recycle_icon" />
          Bijwerken
        </button>
      </form>

      <form action={removeCartItemAction}>
        <input type="hidden" name="productId" value={item.productId} />
        <input type="hidden" name="variantId" value={item.variantId ?? ""} />
        <input type="hidden" name="weightId" value={item.weightId ?? ""} />
        <button className="button button--secondary" type="submit">
          <Icon name="x" />
          Verwijderen
        </button>
      </form>
    </article>
  );
}
