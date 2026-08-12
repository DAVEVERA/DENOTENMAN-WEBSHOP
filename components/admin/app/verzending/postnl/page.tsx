import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function PostNlShippingPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Verzending</p>
        <h1>PostNL</h1>
        <span>PostNL configuratiestatus zonder secrets te tonen.</span>
      </section>

      <section className="admin-card">
        <h2>Configuratie</h2>
        <p>API key aanwezig: {settings.shipping.postnlConfigured ? "Ja" : "Nee"}</p>
        <p>Klantcode aanwezig: {settings.shipping.postnlCustomerCodeConfigured ? "Ja" : "Nee"}</p>
        <p>Klantnummer aanwezig: {settings.shipping.postnlCustomerNumberConfigured ? "Ja" : "Nee"}</p>
      </section>
    </main>
  );
}
