export default function BusinessAccountDetailsPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">

        <h1>Gegevens</h1>

        <form className="auth-form">
          <label>
            Bedrijfsnaam
            <input type="text" name="company" defaultValue="Voorbeeldbedrijf B.V." />
          </label>

          <label>
            Contactpersoon
            <input type="text" name="contact" defaultValue="Jan Jansen" />
          </label>

          <label>
            E-mailadres
            <input type="email" name="email" defaultValue="inkoop@voorbeeldbedrijf.nl" />
          </label>

          <label>
            Factuuradres
            <input type="text" name="invoiceAddress" defaultValue="Voorbeeldstraat 12, 1234 AB Amsterdam" />
          </label>

          <button className="button button--primary" type="submit">
            Gegevens opslaan
          </button>
        </form>
      </section>
    </main>
  );
}