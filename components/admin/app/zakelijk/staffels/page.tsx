import { getBusinessModuleStatus } from "../../../lib/business";

export default async function BusinessPriceTiersPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Staffels</h1>
        <span>Staffelprijzen worden pas actief zodra zakelijke prijstabellen zijn ingericht.</span>
      </section>

      <section className="admin-card">
        <h2>{status.configured ? "Actief" : "Nog niet ingericht"}</h2>
        <p>{status.reason}</p>
      </section>
    </main>
  );
}
