export default function BusinessPaymentPage() {
  return (
    <main className="business-page">
      <section className="container invoice-detail">
        <div>
          <h1>Bestelling afronden</h1>
          <p>
            Controleer de zakelijke bestelling en ga door naar de beveiligde
            betaling.
          </p>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Bestellijst</span>
            <strong>Vaste bestellijst</strong>
          </div>

          <div>
            <span>Betaalmethode</span>
            <strong>Mollie</strong>
          </div>

          <div>
            <span>Factuur</span>
            <strong>Automatisch na betaling</strong>
          </div>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Subtotaal</span>
            <strong>€ 152,48</strong>
          </div>

          <div>
            <span>BTW 21%</span>
            <strong>€ 32,02</strong>
          </div>

          <div>
            <span>Totaal</span>
            <strong>€ 184,50</strong>
          </div>
        </div>

        <button className="button button--primary" type="button">
          Betalen via Mollie
        </button>
      </section>
    </main>
  );
}