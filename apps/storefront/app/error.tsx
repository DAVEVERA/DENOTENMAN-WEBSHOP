"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Er ging iets mis</h1>
        <p>Probeer de pagina opnieuw te laden.</p>

        <button className="button button--primary" type="button" onClick={reset}>
          Opnieuw proberen
        </button>
      </section>
    </main>
  );
}