import Link from "next/link";

export default function BusinessDashboardPage() {
  return (
    <main className="business-page">
      <section className="container dashboard-page">
        <div>
          <h1>Dashboard</h1>
          <p>
            Bekijk bestellijsten, bestellingen, facturen en accountgegevens.
          </p>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Open bestellijsten</span>
            <strong>2</strong>
          </div>

          <div>
            <span>Open facturen</span>
            <strong>1</strong>
          </div>

          <div>
            <span>Laatste bestelling</span>
            <strong>ORD-2026-001</strong>
          </div>
        </div>

        <div className="dashboard-grid">
          <Link href="/zakelijk/bestellijsten" className="dashboard-card">
            <h2>Bestellijsten</h2>
            <p>Bestel uit producten die voor jouw account zijn klaargezet.</p>
          </Link>

          <Link href="/zakelijk/bestellingen" className="dashboard-card">
            <h2>Bestellingen</h2>
            <p>Bekijk eerdere bestellingen en actuele statussen.</p>
          </Link>

          <Link href="/zakelijk/facturen" className="dashboard-card">
            <h2>Facturen</h2>
            <p>Bekijk en download zakelijke facturen.</p>
          </Link>

          <Link href="/zakelijk/gegevens" className="dashboard-card">
            <h2>Gegevens</h2>
            <p>Beheer bedrijfs-, factuur- en contactgegevens.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
