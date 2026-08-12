const taxRates = [
  { name: "Laag tarief", rate: "9%", status: "Actief" },
  { name: "Hoog tarief", rate: "21%", status: "Actief" },
];

export default function TaxSettingsPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>BTW</h1>
        <span>Beheer btw-tarieven en fiscale instellingen.</span>
      </section>

      <section className="admin-list">
        {taxRates.map((tax) => (
          <article key={tax.name} className="admin-list-row">
            <div>
              <h2>{tax.name}</h2>
              <p>{tax.rate}</p>
            </div>

            <strong>{tax.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}