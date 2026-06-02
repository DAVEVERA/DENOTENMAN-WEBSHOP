import { formatAdminDate, listAdminOrders } from "../../lib/orders";

export default async function ShippingPage() {
  const orders = (await listAdminOrders(100)).filter((order) =>
    ["paid", "processing", "shipped"].includes(order.status),
  );

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Verzending</p>
        <h1>Verzendoverzicht</h1>
        <span>Orders die klaar zijn voor verwerking of verzending.</span>
      </section>

      <section className="admin-list">
        {orders.length === 0 ? <p>Geen orders klaar voor verzending.</p> : null}
        {orders.map((order) => (
          <a key={order.id} href={`/bestellingen/${order.id}/verzending`} className="admin-list-row">
            <div>
              <h2>{order.orderNumber}</h2>
              <p>{order.customerName ?? order.customerEmail ?? "Onbekende klant"}</p>
              <p>{formatAdminDate(order.createdAt)}</p>
            </div>
            <span>{order.paymentStatus}</span>
            <strong>{order.status}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
