import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { NewsletterRowActions } from "./NewsletterRowActions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  SCHEDULED: "Ingepland",
  SENT: "Verzonden",
};

export default async function NewsletterCampaignsPage() {
  const newsletters = await prisma.newsletterCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Nieuwsbrieven</h1>
          <p className="mt-1 text-body-sm text-muted">
            {newsletters.length} {newsletters.length === 1 ? "nieuwsbrief" : "nieuwsbrieven"}
          </p>
        </div>
        <Link
          href="/admin/marketing/nieuwsbrieven/nieuw"
          className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
        >
          Nieuwe nieuwsbrief
        </Link>
      </div>

      <p className="mt-4 text-body-sm text-muted">
        Verzending gebeurt handmatig buiten dit systeem — status hier is alleen administratief.
      </p>

      <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-heading">Onderwerp</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3 font-heading">Gepland</th>
              <th className="px-4 py-3 font-heading">Verzonden</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {newsletters.map((newsletter) => (
              <tr key={newsletter.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3">
                  <p className="font-semibold text-text">{newsletter.subject}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      newsletter.status === "SENT"
                        ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                        : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    {STATUS_LABELS[newsletter.status] ?? newsletter.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {newsletter.scheduledAt ? formatDate(newsletter.scheduledAt, "nl") : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {newsletter.sentAt ? formatDate(newsletter.sentAt, "nl") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <NewsletterRowActions
                    newsletterId={newsletter.id}
                    status={newsletter.status}
                    scheduledAt={newsletter.scheduledAt !== null}
                  />
                </td>
              </tr>
            ))}
            {newsletters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Geen nieuwsbrieven gevonden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
