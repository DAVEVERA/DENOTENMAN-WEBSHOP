import { prepareOrderDraftAction } from "../../../actions/checkout.actions";
import { CheckoutLayout } from "../../../components/checkout/CheckoutLayout";
import { OrderReview } from "../../../components/checkout/OrderReview";
import { Icon } from "../../../components/ui/Icon";
import { getCheckoutState } from "../../../lib/checkout";

export default async function CheckoutReviewPage() {
  const checkout = await getCheckoutState();
  const customerName = [checkout.firstName, checkout.lastName]
    .filter((part) => part && part !== "-")
    .join(" ");

  return (
    <main className="business-page">
      <CheckoutLayout>
        <section className="invoice-detail">
          <div>
            <h1>Controleren</h1>
            <p>Controleer je bestelling voordat je betaalt.</p>
          </div>

          <div className="invoice-panel">
            <div>
              <span>
                <Icon name="customer_service" />
                Klant
              </span>
              <strong>{customerName || checkout.email || "Nog niet ingevuld"}</strong>
            </div>

            <div>
              <span>
                <Icon name="truck_icon" />
                Verzending
              </span>
              <strong>{checkout.shippingMethodId ?? "Nog niet gekozen"}</strong>
            </div>

            <div>
              <span>
                <Icon name="creditcard" />
                Betaling
              </span>
              <strong>Mollie draft</strong>
            </div>
          </div>

          <OrderReview />

          <form action={prepareOrderDraftAction}>
            <button className="button button--primary" type="submit">
              <Icon name="Submit_cart" />
              Bestelling als draft voorbereiden
            </button>
          </form>
        </section>
      </CheckoutLayout>
    </main>
  );
}
