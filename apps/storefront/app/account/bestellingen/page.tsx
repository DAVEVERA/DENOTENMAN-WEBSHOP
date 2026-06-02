const orders = [
  { id: "ORD-2026-001", date: "14-05-2026", total: "€ 40,85", status: "Afgerond" },
  { id: "ORD-2026-002", date: "21-05-2026", total: "€ 28,95", status: "In behandeling" },
];

export default function AccountOrdersPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Bestellingen</h1>
          <p>Bekijk eerdere bestellingen en actuele statussen.</p>
        </div>

        <div className="invoice-list">
          {orders.map((order) => (
            <a key={order.id} href={`/account/bestellingen/${order.id}`} className="invoice-row">
              <div>
                <h2>{order.id}</h2>
                <p>{order.date}</p>
              </div>

              <strong>{order.total}</strong>
              <span>{order.status}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}