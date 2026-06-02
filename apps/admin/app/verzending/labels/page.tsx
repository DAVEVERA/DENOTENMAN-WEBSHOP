import { listShipmentLabels } from "../../../lib/fulfillment";
import { formatAdminDate } from "../../../lib/orders";

export default async function ShippingLabelsPage() {
  const labels = await listShipmentLabels();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Verzending</p>
        <h1>Labels</h1>
        <span>Labelbeheer wordt actief zodra shipment-label opslag en PostNL labelgeneratie zijn gekoppeld.</span>
      </section>

      <section className="admin-list">
        {labels.length === 0 ? <p>Geen shipment-label records gevonden.</p> : null}
        {labels.map((label) => (
          <article key={label.id} className="admin-list-row">
            <div>
              <h2>{label.provider}</h2>
              <p>{label.orderId ?? "Geen order gekoppeld"}</p>
            </div>
            <span>{formatAdminDate(label.createdAt)}</span>
            <strong>{label.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
