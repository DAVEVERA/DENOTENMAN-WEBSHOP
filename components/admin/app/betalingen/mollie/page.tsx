import { listAdminPayments } from "../../../lib/orders";

export default async function MolliePaymentsPage() {
  const payments = await listAdminPayments();
  const molliePayments = payments.filter((payment) => payment.provider === "mollie");
  const configured = Boolean(process.env.MOLLIE_API_KEY);
  const testMode =
    process.env.MOLLIE_ENABLE_PAYMENTS === "true" &&
    process.env.MOLLIE_API_KEY?.startsWith("test_");

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Betalingen</p>
        <h1>Mollie</h1>
        <span>Mollie-configuratie en echte payment records.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Configuratie</h2>
          <p>API key aanwezig: {configured ? "Ja" : "Nee"}</p>
          <p>Testbetalingen actief: {testMode ? "Ja" : "Nee"}</p>
        </article>

        <article className="admin-card">
          <h2>Webhook</h2>
          <p>/api/mollie/webhook</p>
        </article>

        <article className="admin-card">
          <h2>Payments</h2>
          <p>{molliePayments.length} Mollie records</p>
        </article>
      </section>

      <section className="admin-section">
        <h2>Laatste Mollie records</h2>
        <div className="admin-list">
          {molliePayments.length === 0 ? <p>Geen Mollie payments gevonden.</p> : null}
          {molliePayments.slice(0, 20).map((payment) => (
            <a key={payment.id} href={`/bestellingen/${payment.orderId}`} className="admin-list-row">
              <div>
                <h2>{payment.orderNumber}</h2>
                <p>{payment.providerPaymentId ?? "Nog geen provider id"}</p>
              </div>
              <span>{payment.customer}</span>
              <strong>{payment.status}</strong>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
