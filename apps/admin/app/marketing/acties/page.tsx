import Link from "next/link";
import { listMarketingCampaigns } from "../../../lib/marketing";

export default async function MarketingActionsPage() {
  const campaigns = await listMarketingCampaigns();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Acties</h1>
        <span>Beheer tijdelijke acties, campagnes en commerciele blokken.</span>
      </section>

      <section className="admin-actions">
        <Link className="admin-button" href="/marketing/acties/nieuw">
          Nieuwe actie
        </Link>
        <Link className="admin-button admin-button--secondary" href="/marketing">
          Terug naar marketing
        </Link>
      </section>

      <section className="admin-list">
        {campaigns.length === 0 ? <p>Geen marketingacties gevonden.</p> : null}
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="admin-list-row">
            <div>
              <h2>{campaign.title}</h2>
              <p>{campaign.subtitle}</p>
            </div>

            <strong>{campaign.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
