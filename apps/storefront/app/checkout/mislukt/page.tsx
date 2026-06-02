export default function CheckoutFailedPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Niet gelukt</h1>
        <p>
          De betaling is niet afgerond. Probeer opnieuw of kies een andere
          betaalmethode.
        </p>

        <a href="/checkout/betaling" className="button button--primary">
          Opnieuw proberen
        </a>
      </section>
    </main>
  );
}