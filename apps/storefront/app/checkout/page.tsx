export default function CheckoutPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Afrekenen</h1>
          <p>Vul je gegevens in en rond je bestelling veilig af.</p>
        </div>

        <div className="dashboard-grid">
          <a href="/checkout/gegevens" className="dashboard-card">
            <h2>1. Gegevens</h2>
            <p>Naam, e-mail en factuurgegevens.</p>
          </a>

          <a href="/checkout/verzending" className="dashboard-card">
            <h2>2. Verzending</h2>
            <p>Kies je verzendmethode.</p>
          </a>

          <a href="/checkout/betaling" className="dashboard-card">
            <h2>3. Betaling</h2>
            <p>Betaal veilig via Mollie.</p>
          </a>
        </div>
      </section>
    </main>
  );
}