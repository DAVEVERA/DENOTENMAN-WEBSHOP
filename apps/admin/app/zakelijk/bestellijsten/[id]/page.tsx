import { BusinessModuleNotice } from "../../../../components/b2b/BusinessModuleNotice";
import { getBusinessModuleStatus } from "../../../../lib/business";

export default async function BusinessOrderListDetailAdminPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Bestellijst</p>
        <h1>Bestellijstdetail</h1>
        <span>Zakelijke bestellijsten worden pas getoond zodra B2B-opslag is ingericht.</span>
      </section>

      <BusinessModuleNotice status={status} />
    </main>
  );
}
