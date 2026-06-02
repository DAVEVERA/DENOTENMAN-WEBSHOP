"use client";

export default function ProductErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Product niet geladen</h1>
        <p>Probeer het product opnieuw te laden.</p>

        <button className="button button--primary" type="button" onClick={reset}>
          Opnieuw proberen
        </button>
      </section>
    </main>
  );
}