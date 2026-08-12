import { formatAdminDate, formatAdminMoney, listAdminPayments } from "../../lib/orders";

export default async function PaymentsPage() {
  const payments = await listAdminPayments();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Betalingen</p>
        <h1>Betalingsoverzicht</h1>
        <span>Echte payment records uit Supabase, gekoppeld aan orders.</span>
      </section>

      <section className="admin-actions">
        <a href="/betalingen/mollie" className="admin-button admin-button--secondary">
          Mollie status
        </a>
        <a href="/betalingen/refunds" className="admin-button admin-button--secondary">
          Refunds
        </a>
      </section>

      <section className="admin-list">
        {payments.length === 0 ? <p>Er zijn nog geen betalingen.</p> : null}
        {payments.map((payment) => (
          <a key={payment.id} href={`/bestellingen/${payment.orderId}`} className="admin-list-row">
            <div>
              <h2>{payment.orderNumber}</h2>
              <p>{payment.customer}</p>
              <p>{payment.providerPaymentId ?? "Nog geen Mollie payment id"}</p>
              <p>{formatAdminDate(payment.updatedAt ?? payment.createdAt)}</p>
            </div>

            <span>{formatAdminMoney(payment.amountCents)}</span>
            <strong>{payment.status}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
