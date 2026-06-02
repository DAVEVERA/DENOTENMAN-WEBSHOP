const orders = [
  {
    id: "ORD-2026-001",
    date: "14-05-2026",
    amount: "€ 184,50",
    status: "Afgerond",
  },
  {
    id: "ORD-2026-002",
    date: "21-05-2026",
    amount: "€ 96,75",
    status: "In behandeling",
  },
];

export default function BusinessOrdersPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Bestellingen</h1>
          <p>Bekijk eerdere zakelijke bestellingen en actuele statussen.</p>
        </div>

        <div className="invoice-list">
          {orders.map((order) => (
            <a
              key={order.id}
              href={`/zakelijk/bestellingen/${order.id}`}
              className="invoice-row"
            >
              <div>
                <h2>{order.id}</h2>
                <p>{order.date}</p>
              </div>

              <strong>{order.amount}</strong>
              <span>{order.status}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}