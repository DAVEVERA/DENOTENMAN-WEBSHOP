const stats = [
  { label: "Bestellingen vandaag", value: "12" },
  { label: "Open betalingen", value: "3" },
  { label: "Lage voorraad", value: "8" },
  { label: "Zakelijke klanten", value: "24" },
];

export default function AdminDashboardPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Dashboard</p>
        <h1>Overzicht</h1>
        <span>Bekijk de belangrijkste webshopactiviteiten in één scherm.</span>
      </section>

      <section className="admin-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="admin-card">
            <h2>{stat.value}</h2>
            <p>{stat.label}</p>
          </article>
        ))}
      </section>
    </main>
  );
}