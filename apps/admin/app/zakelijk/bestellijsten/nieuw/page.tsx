import { BusinessModuleNotice } from "../../../../components/b2b/BusinessModuleNotice";
import { getBusinessModuleStatus } from "../../../../lib/business";

export default async function NewBusinessOrderListPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Nieuwe bestellijst</h1>
        <span>Bestellijsten kunnen worden aangemaakt zodra B2B-opslag is ingericht.</span>
      </section>

      <BusinessModuleNotice status={status} />
    </main>
  );
}
