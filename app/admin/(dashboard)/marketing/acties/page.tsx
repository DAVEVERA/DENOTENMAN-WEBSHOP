import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CampaignRowActions } from "./CampaignRowActions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  ACTIVE: "Actief",
  ENDED: "Beëindigd",
};

export default async function MarketingCampaignsPage() {
  const campaigns = await prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Acties</h1>
          <p className="mt-1 text-body-sm text-muted">
            {campaigns.length} {campaigns.length === 1 ? "actie" : "acties"}
          </p>
        </div>
        <Link
          href="/admin/marketing/acties/nieuw"
          className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
        >
          Nieuwe actie
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-heading">Titel</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3 font-heading">Start</th>
              <th className="px-4 py-3 font-heading">Einde</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3">
                  <p className="font-semibold text-text">{campaign.title}</p>
                  {campaign.description ? (
                    <p className="mt-0.5 line-clamp-1 text-muted">{campaign.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      campaign.status === "ACTIVE"
                        ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                        : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    {STATUS_LABELS[campaign.status] ?? campaign.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {campaign.startsAt ? formatDate(campaign.startsAt, "nl") : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {campaign.endsAt ? formatDate(campaign.endsAt, "nl") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <CampaignRowActions campaignId={campaign.id} />
                </td>
              </tr>
            ))}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Geen acties gevonden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
