import { listReturns } from "../../../lib/fulfillment";
import { formatAdminDate } from "../../../lib/orders";

export default async function ReturnsPage() {
  const returns = await listReturns();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Verzending</p>
        <h1>Retouren</h1>
        <span>Retourbeheer wordt actief zodra retourrecords en retourlabelgeneratie zijn gekoppeld.</span>
      </section>

      <section className="admin-list">
        {returns.length === 0 ? <p>Geen retourrecords gevonden.</p> : null}
        {returns.map((returnRecord) => (
          <article key={returnRecord.id} className="admin-list-row">
            <div>
              <h2>{returnRecord.reason ?? "Retour"}</h2>
              <p>{returnRecord.customerEmail ?? returnRecord.orderId ?? "Onbekend"}</p>
            </div>
            <span>{formatAdminDate(returnRecord.createdAt)}</span>
            <strong>{returnRecord.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
