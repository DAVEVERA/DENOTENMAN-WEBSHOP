import { BusinessModuleNotice } from "../../../components/b2b/BusinessModuleNotice";
import { getBusinessModuleStatus } from "../../../lib/business";

export default async function BusinessDataPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk</p>
        <h1>Gegevens</h1>
        <span>Zakelijke klantgegevens worden actief zodra B2B-opslag is ingericht.</span>
      </section>

      <BusinessModuleNotice status={status} />
    </main>
  );
}
