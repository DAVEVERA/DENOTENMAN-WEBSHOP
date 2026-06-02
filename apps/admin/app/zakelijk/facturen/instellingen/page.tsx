export default function AdminBusinessInvoiceSettingsPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijke facturen</p>
        <h1>Factuurinstellingen</h1>
        <span>
          Beheer factuurnummering, standaardteksten en betaalinformatie voor
          zakelijke facturen.
        </span>
      </section>

      <form className="admin-form">
        <label>
          Factuurprefix
          <input type="text" name="invoicePrefix" defaultValue="FACT-" />
        </label>

        <label>
          Volgend factuurnummer
          <input type="text" name="nextInvoiceNumber" defaultValue="2026-003" />
        </label>

        <label>
          Betaalinstructie
          <textarea
            name="paymentInstruction"
            defaultValue="Betaal de factuur via de aangeboden betaalmethode of volgens de overeengekomen betaaltermijn."
          />
        </label>

        <button className="admin-button" type="submit">
          Factuurinstellingen opslaan
        </button>
      </form>
    </main>
  );
}