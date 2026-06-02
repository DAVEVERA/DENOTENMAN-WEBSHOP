export default function BusinessInvoiceDetailPage() {
  return (
    <main className="business-page">
      <section className="container invoice-detail">
        <div>
          <h1>Factuur 2026-001</h1>
          <p>Bekijk factuurregels, betalingsstatus en gekoppelde bestelling.</p>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Factuurdatum</span>
            <strong>14-05-2026</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>Betaald</strong>
          </div>

          <div>
            <span>Totaal</span>
            <strong>€ 184,50</strong>
          </div>
        </div>

        <a href="#" className="button button--primary">
          Factuur downloaden
        </a>
      </section>
    </main>
  );
}