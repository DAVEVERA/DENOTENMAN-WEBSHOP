import { listRefundRequests } from "../../../lib/fulfillment";
import { listAdminPayments } from "../../../lib/orders";

export default async function RefundsPage() {
  const [payments, refundRequests] = await Promise.all([listAdminPayments(), listRefundRequests()]);
  const refundablePayments = payments.filter((payment) => payment.status === "paid");

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Betalingen</p>
        <h1>Refunds</h1>
        <span>Refund-kandidaten op basis van echte betaalde payments. Terugbetaling uitvoeren volgt na Mollie test/live-validatie.</span>
      </section>

      <section className="admin-list">
        {refundRequests.map((refund) => (
          <a
            key={refund.id}
            href={refund.orderId ? `/bestellingen/${refund.orderId}` : "/betalingen/refunds"}
            className="admin-list-row"
          >
            <div>
              <h2>{refund.providerRefundId ?? "Refund request"}</h2>
              <p>{refund.reason ?? refund.provider}</p>
            </div>
            <span>EUR {(refund.amountCents / 100).toFixed(2)}</span>
            <strong>{refund.status}</strong>
          </a>
        ))}
        {refundablePayments.length === 0 ? <p>Geen betaalde payments beschikbaar voor refunds.</p> : null}
        {refundablePayments.map((payment) => (
          <a key={payment.id} href={`/bestellingen/${payment.orderId}`} className="admin-list-row">
            <div>
              <h2>{payment.orderNumber}</h2>
              <p>{payment.providerPaymentId ?? "Geen provider payment id"}</p>
            </div>
            <span>{payment.customer}</span>
            <strong>{payment.status}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
