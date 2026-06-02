import { getBusinessModuleStatus } from "../../../lib/business";

export default async function BusinessPricesPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Prijzen</h1>
        <span>Klantprijzen en prijsafspraken vereisen een echte B2B-prijstabel.</span>
      </section>

      <section className="admin-card">
        <h2>{status.configured ? "Actief" : "Nog niet ingericht"}</h2>
        <p>{status.reason}</p>
      </section>
    </main>
  );
}
