import { saveNewsletterCampaignAction } from "../../../../actions/marketing.actions";

export default function NewNewsletterPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Nieuwe nieuwsbrief</h1>
        <span>Leg een nieuwsbriefcampagne vast met onderwerp, doelgroep en status.</span>
      </section>

      <form className="admin-form admin-form--wide" action={saveNewsletterCampaignAction}>
        <div className="admin-form-grid">
          <label>
            Titel
            <input type="text" name="title" placeholder="Bijvoorbeeld: Weekaanbieding" required />
          </label>

          <label>
            Onderwerpregel
            <input type="text" name="subject" placeholder="Vers gebrand, scherp geprijsd" />
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Doelgroep
            <select name="audience" defaultValue="all">
              <option value="all">Alle klanten</option>
              <option value="marketing_opt_in">Marketing opt-in</option>
              <option value="b2b">Zakelijke klanten</option>
              <option value="repeat_customers">Terugkerende klanten</option>
            </select>
          </label>

          <label>
            Status
            <select name="status" defaultValue="draft">
              <option value="draft">Concept</option>
              <option value="scheduled">Ingepland</option>
              <option value="sent">Verzonden</option>
              <option value="archived">Gearchiveerd</option>
            </select>
          </label>

          <label>
            Verzendmoment
            <input type="datetime-local" name="sentAt" />
          </label>
        </div>

        <button className="admin-button" type="submit">
          Nieuwsbrief aanmaken
        </button>
      </form>
    </main>
  );
}
