import { saveAdminSettingAction } from "../../../actions/settings.actions";
import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function GeneralSettingsPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Algemeen</h1>
        <span>Productieconfiguratie zoals de admin die server-side ziet.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Webshop</h2>
          <p>Naam: {settings.general.shopName}</p>
          <p>Site URL: {settings.general.siteUrl ?? "Niet ingesteld"}</p>
          <p>Admin URL: {settings.general.adminUrl ?? "Niet ingesteld"}</p>
        </article>
        <article className="admin-card">
          <h2>E-mail afzender</h2>
          <p>Naam: {settings.general.mailFromName ?? "Niet ingesteld"}</p>
          <p>E-mail: {settings.general.mailFromEmail ?? "Niet ingesteld"}</p>
        </article>
      </section>

      <form className="admin-form admin-section" action={saveAdminSettingAction}>
        <input type="hidden" name="key" value="general" />
        <label>
          Webshopnaam
          <input type="text" name="shopName" defaultValue={settings.general.shopName} />
        </label>
        <label>
          Site URL
          <input type="url" name="siteUrl" defaultValue={settings.general.siteUrl ?? ""} />
        </label>
        <label>
          Admin URL
          <input type="url" name="adminUrl" defaultValue={settings.general.adminUrl ?? ""} />
        </label>
        <button className="admin-button" type="submit">
          Algemene instellingen opslaan
        </button>
      </form>
    </main>
  );
}
