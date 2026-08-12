import { listDiscounts } from "../../lib/marketing";

export default async function DiscountsPage() {
  const discounts = await listDiscounts();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Kortingen</h1>
        <span>Beheer kortingscodes, acties en voorwaarden.</span>
      </section>

      <section className="admin-list">
        {discounts.length === 0 ? <p>Geen kortingscodes gevonden.</p> : null}
        {discounts.map((discount) => (
          <article key={discount.id} className="admin-list-row">
            <div>
              <h2>{discount.title}</h2>
              <p>{discount.subtitle}</p>
            </div>

            <strong>{discount.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
