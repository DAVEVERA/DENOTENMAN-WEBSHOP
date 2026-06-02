const invoices = [
  {
    id: "2026-001",
    date: "14-05-2026",
    amount: "€ 184,50",
    status: "Betaald",
  },
  {
    id: "2026-002",
    date: "21-05-2026",
    amount: "€ 96,75",
    status: "Open",
  },
];

export default function BusinessInvoicesPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Facturen</h1>
          <p>Bekijk en download jouw zakelijke facturen.</p>
        </div>

        <div className="invoice-list">
          {invoices.map((invoice) => (
            <a
              key={invoice.id}
              href={`/zakelijk/facturen/${invoice.id}`}
              className="invoice-row"
            >
              <div>
                <h2>Factuur {invoice.id}</h2>
                <p>{invoice.date}</p>
              </div>

              <strong>{invoice.amount}</strong>
              <span>{invoice.status}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}