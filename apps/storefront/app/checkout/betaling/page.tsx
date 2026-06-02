import { savePaymentAction } from "../../../actions/checkout.actions";
import { CheckoutLayout } from "../../../components/checkout/CheckoutLayout";
import { PaymentMethods } from "../../../components/checkout/PaymentMethods";
import { Icon } from "../../../components/ui/Icon";

export default function CheckoutPaymentPage() {
  return (
    <main className="business-page">
      <CheckoutLayout>
        <section className="auth-card">
          <h1>Betaling</h1>

          <form className="auth-form" action={savePaymentAction}>
            <PaymentMethods />

            <button className="button button--primary" type="submit">
              <Icon name="creditcard" />
              Verder naar controleren
            </button>
          </form>
        </section>
      </CheckoutLayout>
    </main>
  );
}
