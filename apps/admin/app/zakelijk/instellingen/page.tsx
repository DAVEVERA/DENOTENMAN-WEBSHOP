export default function AdminBusinessSettingsPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Instellingen</h1>
        <span>
          Beheer betaaltermijnen, factuurinstellingen, toegang, klantgroepen en
          standaardvoorwaarden voor zakelijke klanten.
        </span>
      </section>

      <form className="admin-form">
        <label>
          Standaard betaaltermijn
          <select name="paymentTerm">
            <option>Direct betalen</option>
            <option>7 dagen</option>
            <option>14 dagen</option>
            <option>30 dagen</option>
          </select>
        </label>

        <label>
          Standaard klantgroep
          <select name="customerGroup">
            <option>Horeca</option>
            <option>Kantoren</option>
            <option>Retail</option>
            <option>Overig zakelijk</option>
          </select>
        </label>

        <label>
          Standaard factuurtekst
          <textarea
            name="invoiceText"
            defaultValue="Bedankt voor je zakelijke bestelling bij De Notenman."
          />
        </label>

        <button className="admin-button" type="submit">
          Instellingen opslaan
        </button>
      </form>
    </main>
  );
}