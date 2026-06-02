import Link from "next/link";
import { listMarketingBanners } from "../../../lib/marketing";

export default async function MarketingBannersPage() {
  const banners = await listMarketingBanners();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Banners</h1>
        <span>Beheer commerciele banners, posities en zichtbaarheid.</span>
      </section>

      <section className="admin-actions">
        <Link className="admin-button" href="/marketing/banners/nieuw">
          Nieuwe banner
        </Link>
        <Link className="admin-button admin-button--secondary" href="/marketing">
          Terug naar marketing
        </Link>
      </section>

      <section className="admin-list">
        {banners.length === 0 ? <p>Geen banners gevonden.</p> : null}
        {banners.map((banner) => (
          <article key={banner.id} className="admin-list-row">
            <div>
              <h2>{banner.title}</h2>
              <p>{banner.subtitle}</p>
            </div>

            <strong>{banner.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
