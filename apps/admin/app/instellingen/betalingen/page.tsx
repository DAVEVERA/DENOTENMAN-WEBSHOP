import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function PaymentSettingsPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Betalingen</h1>
        <span>Server-side betaalconfiguratie zonder secrets te tonen.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Mollie</h2>
          <p>API key aanwezig: {settings.payments.mollieConfigured ? "Ja" : "Nee"}</p>
          <p>Testbetalingen actief: {settings.payments.mollieTestPaymentsEnabled ? "Ja" : "Nee"}</p>
          <p>Webhook: {settings.payments.webhookPath}</p>
        </article>
      </section>
    </main>
  );
}
