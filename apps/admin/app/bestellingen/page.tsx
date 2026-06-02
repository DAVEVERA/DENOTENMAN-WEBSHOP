import { formatAdminDate, formatAdminMoney, listAdminOrders } from "../../lib/orders";

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Bestellingen</p>
        <h1>Orderbeheer</h1>
        <span>Bekijk en verwerk echte bestellingen uit Supabase.</span>
      </section>

      <section className="admin-list">
        {orders.length === 0 ? <p>Er zijn nog geen bestellingen geplaatst.</p> : null}
        {orders.map((order) => (
          <a key={order.id} href={`/bestellingen/${order.id}`} className="admin-list-row">
            <div>
              <h2>{order.orderNumber}</h2>
              <p>{order.customerName ?? order.customerEmail ?? "Onbekende klant"}</p>
              <p>{formatAdminDate(order.createdAt)}</p>
            </div>

            <span>{formatAdminMoney(order.totalCents)}</span>
            <strong>{order.status} / {order.paymentStatus}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
