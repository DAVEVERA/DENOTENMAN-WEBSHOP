import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function ShippingSettingsPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Verzending</h1>
        <span>Server-side verzendconfiguratie zonder secrets te tonen.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>PostNL</h2>
          <p>API key aanwezig: {settings.shipping.postnlConfigured ? "Ja" : "Nee"}</p>
          <p>Klantcode aanwezig: {settings.shipping.postnlCustomerCodeConfigured ? "Ja" : "Nee"}</p>
          <p>Klantnummer aanwezig: {settings.shipping.postnlCustomerNumberConfigured ? "Ja" : "Nee"}</p>
        </article>
      </section>
    </main>
  );
}
