import Link from "next/link";
import { connection } from "next/server";
import { getAudienceDetails } from "@/lib/mailchimp/newsletter";
import { getBusinessSegmentInfo } from "@/lib/mailchimp/business-segment";
import { starterNewsletterDocument } from "@/lib/newsletter/document";
import { EMPTY_TARGETING, type NewsletterTargeting } from "@/lib/mailchimp/targeting";
import type { NewsletterAudience } from "@/lib/mailchimp/schemas";
import { newsletterAudienceFor, type ContactType } from "@/lib/marketing/contacts-core";
import { contactTagIds } from "@/lib/marketing/contacts.server";
import { NewsletterEditorForm } from "../NewsletterEditorForm";

const COUNTRY_NAMES = { NL: "Nederland", BE: "België" } as const;

/** Reads the selection handed over from the e-mail address list (?land=BE&type=particulier). */
async function selectionAudience(params: { land?: string; type?: string }): Promise<{
  audience: NewsletterAudience;
  targeting?: NewsletterTargeting;
  notice: { tone: "ok" | "error"; text: string } | null;
}> {
  const country = params.land === "NL" || params.land === "BE" ? params.land : null;
  const type: ContactType | null = params.type === "particulier" || params.type === "zakelijk" ? params.type : null;
  if (!country && !type) return { audience: "all", notice: null };
  const label = [country ? COUNTRY_NAMES[country] : null, type].filter(Boolean).join(" · ");
  const result = newsletterAudienceFor({ country, type }, country ? await contactTagIds() : {});
  if ("error" in result) {
    // Never fall back to everyone: an empty tag selection blocks sending until a choice is made.
    return { audience: "segment", targeting: EMPTY_TARGETING, notice: { tone: "error", text: result.error } };
  }
  return { ...result, notice: { tone: "ok", text: `Ontvangers overgenomen uit de e-mailadressen: ${label}.` } };
}

export default async function NewNewsletterCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ land?: string; type?: string }>;
}) {
  await connection();
  const [audience, businessSegment, selection] = await Promise.all([
    getAudienceDetails(),
    getBusinessSegmentInfo(),
    searchParams.then(selectionAudience),
  ]);

  return (
    <div>
      <Link href="/admin/marketing/nieuwsbrieven" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar nieuwsbrieven
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe nieuwsbrief</h1>
        <p className="mt-1 text-body-sm text-muted">
          Bouw je nieuwsbrief met blokken en zie direct hoe hij eruitziet. Maak eerst een concept; testen, plannen en verzenden kan daarna vanuit de editor.
        </p>
      </div>
      {selection.notice ? (
        <p className={`mt-4 rounded-panel border p-3 text-body-sm ${selection.notice.tone === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>
          {selection.notice.text}
        </p>
      ) : null}
      <div className="mt-8">
        <NewsletterEditorForm
          mode="create"
          recipientCount={audience.recipientCount}
          businessRecipientCount={businessSegment.memberCount}
          businessSegmentReady={businessSegment.segmentId !== null}
          initialDocument={starterNewsletterDocument()}
          initial={{
            subject: "",
            previewText: "",
            title: "",
            fromName: audience.fromName,
            replyTo: audience.replyTo,
            contentHtml: "<p></p>",
            audience: selection.audience,
            targeting: selection.targeting,
          }}
        />
      </div>
    </div>
  );
}
