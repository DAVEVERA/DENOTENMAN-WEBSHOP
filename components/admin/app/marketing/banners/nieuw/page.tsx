import { saveMarketingBannerAction } from "../../../../actions/marketing.actions";

export default function NewMarketingBannerPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Nieuwe banner</h1>
        <span>Voeg een commerciele banner toe voor homepage, categorieen of actieblokken.</span>
      </section>

      <form className="admin-form admin-form--wide" action={saveMarketingBannerAction}>
        <div className="admin-form-grid">
          <label>
            Titel
            <input type="text" name="title" placeholder="Bijvoorbeeld: Verse notenactie" required />
          </label>

          <label>
            Positie
            <select name="position" defaultValue="homepage">
              <option value="homepage">Homepage</option>
              <option value="category">Categoriepagina</option>
              <option value="product">Productpagina</option>
              <option value="checkout">Checkout</option>
            </select>
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Afbeelding URL
            <input type="url" name="image" placeholder="https://..." />
          </label>

          <label>
            Link URL
            <input type="url" name="href" placeholder="https://denotenman.nl/..." />
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
          Banner aanmaken
        </button>
      </form>
    </main>
  );
}
