import { saveMarketingCampaignAction } from "../../../../actions/marketing.actions";

export default function NewMarketingCampaignPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Nieuwe actie</h1>
        <span>Maak een marketingactie aan voor site, e-mail, social of zakelijke klanten.</span>
      </section>

      <form className="admin-form admin-form--wide" action={saveMarketingCampaignAction}>
        <div className="admin-form-grid">
          <label>
            Titel
            <input type="text" name="title" placeholder="Bijvoorbeeld: Zomeractie notenmix" required />
          </label>

          <label>
            Kanaal
            <select name="channel" defaultValue="site">
              <option value="site">Site</option>
              <option value="email">E-mail</option>
              <option value="social">Social</option>
              <option value="b2b">Zakelijk</option>
            </select>
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Status
            <select name="status" defaultValue="draft">
              <option value="draft">Concept</option>
              <option value="active">Actief</option>
              <option value="paused">Gepauzeerd</option>
              <option value="archived">Gearchiveerd</option>
            </select>
          </label>

          <label>
            Startdatum
            <input type="datetime-local" name="startsAt" />
          </label>

          <label>
            Einddatum
            <input type="datetime-local" name="endsAt" />
          </label>
        </div>

        <button className="admin-button" type="submit">
          Actie aanmaken
        </button>
      </form>
    </main>
  );
}
