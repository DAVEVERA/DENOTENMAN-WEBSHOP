import Link from "next/link";
import { getOrderCheckoutStatus } from "../../../lib/orders";

type CheckoutSuccessPageProps = {
  searchParams?: Promise<{
    draft?: string;
    mollie?: string;
    order?: string;
  }>;
};

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const params = await searchParams;
  const isDraft = params?.draft === "1";
  const mollieDisabled = params?.mollie === "disabled";
  const orderNumber = params?.order;
  const orderStatus = await getOrderCheckoutStatus(orderNumber);
  const currentPaymentStatus = orderStatus?.paymentStatus ?? (isDraft ? "draft" : null);

  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>{currentPaymentStatus === "paid" ? "Bedankt" : isDraft ? "Klaar voor Mollie" : "Bestelling ontvangen"}</h1>
        <p>
          {currentPaymentStatus === "paid"
            ? "Je betaling is ontvangen. Je ontvangt automatisch een bevestiging per e-mail."
            : isDraft
              ? "Je bestelling is gevalideerd en klaar om in de volgende stap aan Mollie gekoppeld te worden."
              : "Je bestelling is ontvangen. Je ontvangt automatisch een bevestiging per e-mail."}
        </p>
        {orderStatus ? (
          <div className="invoice-panel">
            <div>
              <span>Ordernummer</span>
              <strong>{orderStatus.orderNumber}</strong>
            </div>
            <div>
              <span>Orderstatus</span>
              <strong>{orderStatus.orderStatus}</strong>
            </div>
            <div>
              <span>Betaalstatus</span>
              <strong>{orderStatus.paymentStatus}</strong>
            </div>
          </div>
        ) : orderNumber ? (
          <p>Ordernummer: {orderNumber}</p>
        ) : null}
        {mollieDisabled ? (
          <p>Betaling is nog niet gestart omdat Mollie payments niet voor deze omgeving zijn ingeschakeld.</p>
        ) : null}

        <Link href="/winkel" className="button button--primary">
          Verder winkelen
        </Link>
      </section>
    </main>
  );
}
