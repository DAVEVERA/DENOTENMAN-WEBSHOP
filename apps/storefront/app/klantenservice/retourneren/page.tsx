export default function ReturnsInfoPage() {
  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Retourneren</h1>
          <p>
            Bekijk de voorwaarden voor retourneren en neem contact op bij vragen
            over je bestelling.
          </p>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <h2>Retour aanmelden</h2>
            <p>Neem contact op met de klantenservice.</p>
          </article>

          <article className="dashboard-card">
            <h2>Controle</h2>
            <p>Retouren worden beoordeeld volgens het retourbeleid.</p>
          </article>
        </div>
      </section>
    </main>
  );
}