import { CartItem } from "../../components/cart/CartItem";
import { CartSummary } from "../../components/cart/CartSummary";
import { CouponForm } from "../../components/cart/CouponForm";
import { getCart } from "../../lib/cart";

export default async function CartPage() {
  const cart = await getCart();

  return (
    <main className="business-page">
      <section className="container cart-page">
        <div>
          <h1>Jouw mand</h1>
          <p>Controleer je producten voordat je afrekent.</p>
        </div>

        <div className="cart-layout">
          <div className="product-list">
            {cart.items.length === 0 ? <p>Je winkelwagen is nog leeg.</p> : null}
            {cart.items.map((item) => (
              <CartItem
                key={`${item.productId}-${item.variantId ?? "default"}-${item.weightId ?? "default"}`}
                item={item}
              />
            ))}

            <CouponForm />
          </div>

          <CartSummary cart={cart} />
        </div>
      </section>
    </main>
  );
}
