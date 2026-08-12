import Link from "next/link";
import { listAdminOrders } from "../../../lib/orders";

export default async function MarketingAnalyticsPage() {
  const orders = await listAdminOrders(500);
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const revenueCents = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const averageCents = paidOrders.length > 0 ? Math.round(revenueCents / paidOrders.length) : 0;
  const metrics = [
    { label: "Bestellingen", value: String(orders.length) },
    { label: "Betaalde omzet", value: `EUR ${(revenueCents / 100).toFixed(2)}` },
    { label: "Gemiddelde orderwaarde", value: `EUR ${(averageCents / 100).toFixed(2)}` },
  ];

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Analytics</h1>
        <span>Bekijk commerciele prestaties, conversie en omzetinzichten.</span>
      </section>

      <section className="admin-actions">
        <Link className="admin-button admin-button--secondary" href="/marketing">
          Terug naar marketing
        </Link>
      </section>

      <section className="admin-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="admin-card">
            <h2>{metric.value}</h2>
            <p>{metric.label}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
