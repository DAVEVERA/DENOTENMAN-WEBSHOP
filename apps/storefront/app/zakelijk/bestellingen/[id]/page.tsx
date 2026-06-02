import Link from "next/link";

const items = [
  {
    name: "Amandelen ongezouten",
    quantity: "2 × 1 kg",
    total: "€ 29,90",
  },
  {
    name: "Cashewnoten gebrand",
    quantity: "3 × 1 kg",
    total: "€ 50,85",
  },
  {
    name: "Notenmix luxe",
    quantity: "5 × 1 kg",
    total: "€ 94,75",
  },
];

export default function BusinessOrderDetailPage() {
  return (
    <main className="business-page">
      <section className="container invoice-detail">
        <div>
          <h1>ORD-2026-001</h1>
          <p>Bekijk producten, status, betaling en gekoppelde factuur.</p>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Besteldatum</span>
            <strong>14-05-2026</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>Afgerond</strong>
          </div>

          <div>
            <span>Totaal</span>
            <strong>€ 184,50</strong>
          </div>
        </div>

        <div className="product-list">
          {items.map((item) => (
            <article key={item.name} className="product-row">
              <div>
                <h2>{item.name}</h2>
                <p>{item.quantity}</p>
              </div>

              <strong>{item.total}</strong>
            </article>
          ))}
        </div>

        <Link href="/zakelijk/facturen/2026-001" className="button button--primary">
          Factuur bekijken
        </Link>
      </section>
    </main>
  );
}
