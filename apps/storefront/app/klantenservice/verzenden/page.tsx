export default function ShippingInfoPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Verzenden</h1>
          <p>
            Bestellingen worden zorgvuldig verpakt en verzonden via PostNL.
          </p>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Verzendpartner</span>
            <strong>PostNL</strong>
          </div>

          <div>
            <span>Verzendkosten</span>
            <strong>€ 6,95</strong>
          </div>

          <div>
            <span>Gratis verzending</span>
            <strong>Vanaf € 50</strong>
          </div>
        </div>
      </section>
    </main>
  );
}