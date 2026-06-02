import Link from "next/link";

export default function BrandDetailPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>De Notenman</h1>
          <p>Producten uit de eigen selectie van De Notenman.</p>
        </div>

        <div className="list-grid">
          <Link href="/winkel/amandelen-ongezouten" className="dashboard-card">
            <h2>Amandelen ongezouten</h2>
            <p>EUR 14,95</p>
          </Link>

          <Link href="/winkel/notenmix-luxe" className="dashboard-card">
            <h2>Notenmix luxe</h2>
            <p>EUR 18,95</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
