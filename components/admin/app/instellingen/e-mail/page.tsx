import { saveAdminSettingAction } from "../../../actions/settings.actions";
import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function EmailSettingsPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>E-mail</h1>
        <span>Beheer afzendergegevens, e-mailtemplates en notificaties.</span>
      </section>

      <form className="admin-form" action={saveAdminSettingAction}>
        <input type="hidden" name="key" value="email" />
        <label>
          Afzendernaam
          <input type="text" name="mailFromName" defaultValue={settings.general.mailFromName ?? ""} />
        </label>

        <label>
          Afzender e-mailadres
          <input type="email" name="mailFromEmail" defaultValue={settings.general.mailFromEmail ?? ""} />
        </label>

        <label>
          Standaard ordertekst
          <textarea
            name="orderText"
            defaultValue="Bedankt voor je bestelling bij De Notenman."
          />
        </label>

        <button className="admin-button" type="submit">
          E-mailinstellingen opslaan
        </button>
      </form>
    </main>
  );
}
