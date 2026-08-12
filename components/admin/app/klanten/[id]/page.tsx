import { notFound } from "next/navigation";
import { getAdminCustomer } from "../../../lib/customers";
import { formatAdminDate, formatAdminMoney } from "../../../lib/orders";

type AdminCustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminCustomerDetailPage({ params }: AdminCustomerDetailPageProps) {
  const { id } = await params;
  const customer = await getAdminCustomer(id);

  if (!customer) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Klant</p>
        <h1>{customer.name}</h1>
        <span>Orderhistorie en klantwaarde op basis van echte Supabase-orders.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Contact</h2>
          <p>{customer.email}</p>
        </article>

        <article className="admin-card">
          <h2>Bestellingen</h2>
          <p>{customer.orderCount} orders</p>
        </article>

        <article className="admin-card">
          <h2>Omzet</h2>
          <p>{formatAdminMoney(customer.totalCents)}</p>
        </article>
      </section>

      <section className="admin-section">
        <h2>Orderhistorie</h2>
        <div className="admin-list">
          {customer.orders.map((order) => (
            <a key={order.id} href={`/bestellingen/${order.id}`} className="admin-list-row">
              <div>
                <h2>{order.orderNumber}</h2>
                <p>{formatAdminDate(order.createdAt)}</p>
              </div>
              <span>{formatAdminMoney(order.totalCents)}</span>
              <strong>{order.status}</strong>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
