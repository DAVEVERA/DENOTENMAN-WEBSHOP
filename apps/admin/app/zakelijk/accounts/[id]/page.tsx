import { BusinessModuleNotice } from "../../../../components/b2b/BusinessModuleNotice";
import { getBusinessModuleStatus } from "../../../../lib/business";

export default async function AdminBusinessAccountDetailPage() {
  const status = await getBusinessModuleStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijk account</p>
        <h1>Accountdetail</h1>
        <span>Zakelijke accountdetails worden pas getoond zodra B2B-opslag is ingericht.</span>
      </section>

      <BusinessModuleNotice status={status} />
    </main>
  );
}
