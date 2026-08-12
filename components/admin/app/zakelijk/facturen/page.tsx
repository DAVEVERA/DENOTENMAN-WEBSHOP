import { listBusinessInvoiceCandidates } from "../../../lib/business";
import { formatAdminDate, formatAdminMoney } from "../../../lib/orders";

export default async function AdminBusinessInvoicesPage() {
  const orders = await listBusinessInvoiceCandidates();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Facturen</h1>
        <span>Factuurbasis uit echte orders. Formele factuurnummers/PDF&apos;s volgen zodra factuur-opslag actief is.</span>
      </section>

      <section className="admin-list">
        {orders.length === 0 ? <p>Geen orders beschikbaar als factuurbasis.</p> : null}
        {orders.map((order) => (
          <a key={order.id} href={`/bestellingen/${order.id}/factuur`} className="admin-list-row">
            <div>
              <h2>{order.orderNumber}</h2>
              <p>{order.customerName ?? order.customerEmail}</p>
              <p>{formatAdminDate(order.createdAt)}</p>
            </div>
            <span>{formatAdminMoney(order.totalCents)}</span>
            <strong>{order.paymentStatus}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
