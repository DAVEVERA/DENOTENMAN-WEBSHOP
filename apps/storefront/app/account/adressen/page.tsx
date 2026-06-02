export default function AccountAddressesPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Adressen</h1>

        <form className="auth-form">
          <label>
            Straat en huisnummer
            <input type="text" name="street" defaultValue="Voorbeeldstraat 12" />
          </label>

          <label>
            Postcode
            <input type="text" name="postalCode" defaultValue="1234 AB" />
          </label>

          <label>
            Plaats
            <input type="text" name="city" defaultValue="Amsterdam" />
          </label>

          <button className="button button--primary" type="submit">
            Adres opslaan
          </button>
        </form>
      </section>
    </main>
  );
}