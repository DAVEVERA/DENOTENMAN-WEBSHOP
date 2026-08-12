import { getBusinessModuleStatus } from "../../../lib/business";

export default async function AdminBusinessOrderListsPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Bestellijsten</h1>
        <span>Zakelijke bestellijsten worden pas getoond zodra de B2B-tabellen bestaan.</span>
      </section>

      <section className="admin-card">
        <h2>{status.configured ? "Actief" : "Nog niet ingericht"}</h2>
        <p>{status.reason}</p>
      </section>
    </main>
  );
}
