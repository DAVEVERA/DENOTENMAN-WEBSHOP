export default function AccountDetailsPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Gegevens</h1>

        <form className="auth-form">
          <label>
            Naam
            <input type="text" name="name" defaultValue="Jan Jansen" />
          </label>

          <label>
            E-mailadres
            <input type="email" name="email" defaultValue="jan@example.com" />
          </label>

          <label>
            Telefoonnummer
            <input type="text" name="phone" placeholder="Telefoonnummer" />
          </label>

          <button className="button button--primary" type="submit">
            Gegevens opslaan
          </button>
        </form>
      </section>
    </main>
  );
}