import Link from "next/link";
import { connection } from "next/server";
import {
  getAudienceRecipientCount,
  getNewsletterCampaign,
  getNewsletterReport,
} from "@/lib/mailchimp/newsletter";
import { NewsletterEditorForm } from "../NewsletterEditorForm";

export default async function NewsletterCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  try {
    const campaign = await getNewsletterCampaign(id);
    const [recipientCount, report] = await Promise.all([
      getAudienceRecipientCount(),
      campaign.status === "sent" ? getNewsletterReport(id) : Promise.resolve(null),
    ]);

    return (
      <div>
        <Link href="/admin/marketing/nieuwsbrieven" className="text-body-sm text-accent-hover underline underline-offset-4">
          ← Terug naar nieuwsbrieven
        </Link>
        <div className="mt-3">
          <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">
            {campaign.status === "save" ? "Mailchimp-concept" : "Mailchimp-campagne"}
          </p>
          <h1 className="mt-1 text-heading-xl text-text">{campaign.subject}</h1>
        </div>

        {report ? (
          <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Campagneresultaten">
            {[
              ["Verstuurd", report.emailsSent],
              ["Uniek geopend", report.uniqueOpens],
              ["Klikkers", report.subscriberClicks],
              ["Afgemeld", report.unsubscribed],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-panel border border-border bg-surface p-4 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-heading text-muted">{label}</p>
                <p className="mt-1 font-heading text-heading-md text-text">{value}</p>
              </div>
            ))}
          </section>
        ) : null}

        <div className="mt-8">
          <NewsletterEditorForm
            mode="edit"
            campaignId={id}
            campaignStatus={campaign.status}
            recipientCount={recipientCount}
            initial={{
              subject: campaign.subject,
              previewText: campaign.previewText,
              title: campaign.title,
              fromName: campaign.fromName,
              replyTo: campaign.replyTo,
              contentHtml: campaign.contentHtml,
            }}
          />
        </div>
      </div>
    );
  } catch {
    return (
      <div>
        <Link href="/admin/marketing/nieuwsbrieven" className="text-body-sm text-accent-hover underline underline-offset-4">
          ← Terug naar nieuwsbrieven
        </Link>
        <h1 className="mt-3 text-heading-xl text-text">Campagne niet beschikbaar</h1>
        <p className="mt-4 rounded-panel border border-red-200 bg-red-50 p-5 text-body-sm text-red-800">
          Mailchimp kon deze campagne niet laden. Controleer of het concept nog bestaat.
        </p>
      </div>
    );
  }
}
