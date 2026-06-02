const items = [
  { name: "Amandelen ongezouten", quantity: "1 × 1kg", total: "€ 14,95" },
  { name: "Notenmix luxe", quantity: "1 × 1kg", total: "€ 18,95" },
];

export default function AccountOrderDetailPage() {
  return (
    <main className="business-page">
      <section className="container invoice-detail">
        <div>
          <h1>ORD-2026-001</h1>
          <p>Bekijk producten, status, betaling en verzendinformatie.</p>
        </div>

        <div className="invoice-panel">
          <div>
            <span>Datum</span>
            <strong>14-05-2026</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>Afgerond</strong>
          </div>

          <div>
            <span>Totaal</span>
            <strong>€ 40,85</strong>
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
      </section>
    </main>
  );
}