import { saveCheckoutDetailsAction } from "../../../actions/checkout.actions";
import { AddressForm } from "../../../components/checkout/AddressForm";
import { CheckoutLayout } from "../../../components/checkout/CheckoutLayout";
import { CustomerForm } from "../../../components/checkout/CustomerForm";
import { Icon } from "../../../components/ui/Icon";
import { getCheckoutState } from "../../../lib/checkout";

export default async function CheckoutDetailsPage() {
  const checkout = await getCheckoutState();

  return (
    <main className="business-page">
      <CheckoutLayout>
        <section className="auth-card">
          <h1>Gegevens</h1>

          <form className="auth-form" action={saveCheckoutDetailsAction}>
            <CustomerForm checkout={checkout} />
            <AddressForm checkout={checkout} />

            <button className="button button--primary" type="submit">
              <Icon name="checkout" />
              Verder naar verzending
            </button>
          </form>
        </section>
      </CheckoutLayout>
    </main>
  );
}
