import Link from "next/link";
import { connection } from "next/server";
import {
  getAudienceDetails,
  listNewsletterCampaigns,
  type NewsletterSummary,
} from "@/lib/mailchimp/newsletter";
import { NewsletterRowActions } from "./NewsletterRowActions";

const STATUS_LABELS: Record<NewsletterSummary["status"], string> = {
  save: "Concept",
  schedule: "Ingepland",
  sending: "Wordt verzonden",
  sent: "Verzonden",
  paused: "Gepauzeerd",
  unknown: "Onbekend",
};

function formatCampaignDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CampaignTable({ campaigns }: { campaigns: NewsletterSummary[] }) {
  if (campaigns.length === 0) {
    return <p className="px-5 py-8 text-center text-body-sm text-muted">Geen campagnes gevonden.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-3 font-heading">Onderwerp</th>
            <th className="px-4 py-3 font-heading">Status</th>
            <th className="px-4 py-3 font-heading">Datum</th>
            <th className="px-4 py-3 font-heading">Ontvangers</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b border-border last:border-0 hover:bg-background">
              <td className="px-4 py-3">
                <p className="font-semibold text-text">{campaign.subject}</p>
                <p className="mt-0.5 text-xs text-muted">{campaign.title || campaign.id}</p>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover">
                  {STATUS_LABELS[campaign.status]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {formatCampaignDate(campaign.sendTime ?? campaign.createdAt)}
              </td>
              <td className="px-4 py-3 text-muted">{campaign.recipientCount || "—"}</td>
              <td className="px-4 py-3 text-right">
                <NewsletterRowActions campaignId={campaign.id} status={campaign.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function NewsletterCampaignsPage() {
  await connection();

  try {
    const [{ drafts, sent }, audience] = await Promise.all([
      listNewsletterCampaigns(),
      getAudienceDetails(),
    ]);

    return (
      <div>
        <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
          ← Terug naar marketing
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">
              Mailchimp · {audience.recipientCount} ontvangers
            </p>
            <h1 className="mt-1 text-heading-xl text-text">Nieuwsbrieven</h1>
            <p className="mt-1 text-body-sm text-muted">
              Concepten en verzonden campagnes uit de audience De Notenman.
            </p>
          </div>
          <Link
            href="/admin/marketing/nieuwsbrieven/nieuw"
            className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
          >
            Nieuwe nieuwsbrief
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="text-heading-md text-text">Concepten</h2>
          <div className="mt-3 overflow-hidden rounded-panel border border-border bg-surface shadow-card">
            <CampaignTable campaigns={drafts} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-heading-md text-text">Verzonden archief</h2>
          <div className="mt-3 overflow-hidden rounded-panel border border-border bg-surface shadow-card">
            <CampaignTable campaigns={sent} />
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div>
        <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
          ← Terug naar marketing
        </Link>
        <h1 className="mt-3 text-heading-xl text-text">Nieuwsbrieven</h1>
        <div className="mt-6 rounded-panel border border-red-200 bg-red-50 p-5 text-body-sm text-red-800">
          Mailchimp kon niet worden geladen. Controleer de koppeling en probeer opnieuw.
        </div>
      </div>
    );
  }
}
