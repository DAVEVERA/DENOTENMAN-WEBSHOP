import Link from "next/link";
import { getBusinessModuleStatus, listBusinessCustomers } from "../../../lib/business";

export default async function AdminBusinessCustomersPage() {
  const [status, customers] = await Promise.all([
    getBusinessModuleStatus(),
    listBusinessCustomers().catch(() => []),
  ]);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Zakelijke klanten</h1>
        <span>Beheer bedrijven, contactpersonen, factuurgegevens en toegang.</span>
      </section>

      <section className="admin-card">
        <h2>{status.configured ? "Actief" : "Nog niet ingericht"}</h2>
        <p>{status.reason}</p>
      </section>

      <section className="admin-actions">
        <Link className="admin-button" href="/zakelijk/klanten/nieuw">
          Nieuwe zakelijke klant
        </Link>
      </section>

      <section className="admin-list admin-section">
        {customers.length === 0 ? <p>Geen zakelijke klanten gevonden.</p> : null}
        {customers.map((customer) => (
          <Link key={customer.id} href={`/zakelijk/klanten/${customer.id}`} className="admin-list-row">
            <div>
              <h2>{customer.company}</h2>
              <p>{customer.contactName ?? customer.email}</p>
            </div>
            <span>{customer.email}</span>
            <strong>{customer.status}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
