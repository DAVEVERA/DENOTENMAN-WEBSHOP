import Link from "next/link";
import { listNewsletterCampaigns } from "../../../lib/marketing";

export default async function NewslettersPage() {
  const newsletters = await listNewsletterCampaigns();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Nieuwsbrieven</h1>
        <span>Beheer nieuwsbrieven, doelgroepen en verzendstatussen.</span>
      </section>

      <section className="admin-actions">
        <Link className="admin-button" href="/marketing/nieuwsbrieven/nieuw">
          Nieuwe nieuwsbrief
        </Link>
        <Link className="admin-button admin-button--secondary" href="/marketing">
          Terug naar marketing
        </Link>
      </section>

      <section className="admin-list">
        {newsletters.length === 0 ? <p>Geen nieuwsbrieven gevonden.</p> : null}
        {newsletters.map((newsletter) => (
          <article key={newsletter.id} className="admin-list-row">
            <div>
              <h2>{newsletter.title}</h2>
              <p>{newsletter.subtitle}</p>
            </div>

            <strong>{newsletter.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
