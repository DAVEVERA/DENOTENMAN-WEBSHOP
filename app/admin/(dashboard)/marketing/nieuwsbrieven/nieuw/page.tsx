import Link from "next/link";
import { connection } from "next/server";
import { getAudienceDetails } from "@/lib/mailchimp/newsletter";
import { NewsletterEditorForm } from "../NewsletterEditorForm";

export default async function NewNewsletterCampaignPage() {
  await connection();
  const audience = await getAudienceDetails();

  return (
    <div>
      <Link href="/admin/marketing/nieuwsbrieven" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar nieuwsbrieven
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe nieuwsbrief</h1>
        <p className="mt-1 text-body-sm text-muted">
          Maak eerst een concept. Testen, plannen en verzenden kan daarna vanuit de editor.
        </p>
      </div>
      <div className="mt-8">
        <NewsletterEditorForm
          mode="create"
          recipientCount={audience.recipientCount}
          initial={{
            subject: "",
            previewText: "",
            title: "",
            fromName: audience.fromName,
            replyTo: audience.replyTo,
            contentHtml: "<p></p>",
          }}
        />
      </div>
    </div>
  );
}
