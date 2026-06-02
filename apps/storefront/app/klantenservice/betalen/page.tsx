export default function PaymentInfoPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Betalen</h1>
          <p>Betaal veilig via Mollie met de beschikbare betaalmethodes.</p>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <h2>iDEAL</h2>
            <p>Veilig betalen via je eigen bank.</p>
          </article>

          <article className="dashboard-card">
            <h2>Bancontact</h2>
            <p>Beschikbaar voor Belgische klanten.</p>
          </article>

          <article className="dashboard-card">
            <h2>Creditcard</h2>
            <p>Beschikbaar via Mollie.</p>
          </article>
        </div>
      </section>
    </main>
  );
}