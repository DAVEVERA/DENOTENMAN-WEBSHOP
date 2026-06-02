import { saveShippingAction } from "../../../actions/checkout.actions";
import { CheckoutLayout } from "../../../components/checkout/CheckoutLayout";
import { ShippingMethods } from "../../../components/checkout/ShippingMethods";
import { Icon } from "../../../components/ui/Icon";
import { getCheckoutState } from "../../../lib/checkout";

export default async function CheckoutShippingPage() {
  const checkout = await getCheckoutState();

  return (
    <main className="business-page">
      <CheckoutLayout>
        <section className="auth-card">
          <h1>Verzending</h1>

          <form className="auth-form" action={saveShippingAction}>
            <ShippingMethods checkout={checkout} />

            <button className="button button--primary" type="submit">
              <Icon name="truck_icon" />
              Verder naar betaling
            </button>
          </form>
        </section>
      </CheckoutLayout>
    </main>
  );
}
