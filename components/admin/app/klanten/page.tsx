import { listAdminCustomers } from "../../lib/customers";
import { formatAdminDate, formatAdminMoney } from "../../lib/orders";

export default async function AdminCustomersPage() {
  const customers = await listAdminCustomers();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Klanten</p>
        <h1>Klantenoverzicht</h1>
        <span>Klanten afgeleid uit orderdata, zonder fictieve records.</span>
      </section>

      <section className="admin-list">
        {customers.length === 0 ? <p>Er zijn nog geen klanten met orders.</p> : null}
        {customers.map((customer) => (
          <a key={customer.email} href={`/klanten/${customer.id}`} className="admin-list-row">
            <div>
              <h2>{customer.name}</h2>
              <p>{customer.email}</p>
              <p>Laatste order: {formatAdminDate(customer.latestOrderAt)}</p>
            </div>

            <span>{formatAdminMoney(customer.totalCents)}</span>
            <strong>{customer.orderCount} orders</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
