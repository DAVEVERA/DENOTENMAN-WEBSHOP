import Link from "next/link";
import { getAdminDashboard } from "../../lib/dashboard";
import { formatAdminDate, formatAdminMoney } from "../../lib/orders";

const actions = [
  { label: "Nieuw product", href: "/producten/nieuw" },
  { label: "Bestellingen verwerken", href: "/bestellingen" },
  { label: "Betalingen controleren", href: "/betalingen" },
];

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboard();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <h1>Dashboard</h1>
      </section>

      <section className="admin-actions">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="admin-button">
            {action.label}
          </Link>
        ))}
      </section>

      <section className="admin-grid">
        {dashboard.stats.map((stat) => (
          <Link key={stat.label} className="admin-card admin-link-card" href={stat.href}>
            <h2>{stat.value}</h2>
            <p>{stat.label}</p>
          </Link>
        ))}
      </section>

      <section className="admin-section">
        <h2>Recente bestellingen</h2>
        <div className="admin-list">
          {dashboard.recentOrders.length === 0 ? <p>Er zijn nog geen bestellingen.</p> : null}
          {dashboard.recentOrders.map((order) => (
            <Link key={order.id} href={`/bestellingen/${order.id}`} className="admin-list-row">
              <div>
                <h2>{order.orderNumber}</h2>
                <p>{order.customerName ?? order.customerEmail ?? "Onbekende klant"}</p>
              </div>
              <span>{formatAdminMoney(order.totalCents)}</span>
              <strong>{order.status}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-grid admin-grid--two">
        <article className="admin-card">
          <h2>Open betalingen</h2>
          <div className="admin-stack">
            {dashboard.openPayments.length === 0 ? <p>Geen open betalingen.</p> : null}
            {dashboard.openPayments.map((payment) => (
              <Link key={payment.id} href={`/bestellingen/${payment.orderId}`} className="admin-inline-link">
                <span>{payment.orderNumber}</span>
                <strong>{payment.status}</strong>
              </Link>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <h2>Voorraad aandacht</h2>
          <div className="admin-stack">
            {dashboard.lowInventory.length === 0 ? <p>Geen voorraadmeldingen.</p> : null}
            {dashboard.lowInventory.map((item) => (
              <Link
                key={`${item.productId}-${item.variantId}`}
                href={`/producten/${item.productId}`}
                className="admin-inline-link"
              >
                <span>{item.productName}</span>
                <strong>{item.stockLabel}</strong>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <p className="admin-muted">Laatst geladen: {formatAdminDate(new Date().toISOString())}</p>
    </main>
  );
}
