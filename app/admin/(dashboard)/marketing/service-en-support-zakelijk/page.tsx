import Link from "next/link";
import { connection } from "next/server";
import { getBusinessLifecycleEmailContent } from "@/lib/business-lifecycle-email-content";

const CARDS = [
  { kind: "invitation" as const, title: "Uitnodiging", description: "Verstuurd wanneer een zakelijk account wordt geactiveerd." },
  { kind: "invoice" as const, title: "Factuur", description: "Verstuurd na een betaalde zakelijke bestelling." },
];

export default async function BusinessLifecycleEmailsPage() {
  await connection();
  const [invitation, invoice] = await Promise.all([
    getBusinessLifecycleEmailContent("INVITATION"),
    getBusinessLifecycleEmailContent("INVOICE"),
  ]);
  const contentByKind = { invitation, invoice };

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Service en support zakelijk</h1>
        <p className="mt-1 max-w-2xl text-body-sm text-muted">
          Bewerk de onderwerpregel, kop, introtekst en knoptekst van de uitnodigings- en factuurmail voor
          zakelijke klanten.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((card) => {
          const content = contentByKind[card.kind];
          return (
            <Link
              key={card.kind}
              href={`/admin/marketing/service-en-support-zakelijk/${card.kind}`}
              className="rounded-panel border border-border bg-surface p-6 shadow-card transition-colors duration-hover-fast hover:border-border-hover"
            >
              <h2 className="font-heading text-body-md font-semibold text-text">{card.title}</h2>
              <p className="mt-1 text-body-sm text-muted">{card.description}</p>
              <p className="mt-3 truncate text-body-sm text-text">{content.subject}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-panel border border-border bg-surface p-6 shadow-card">
        <h2 className="font-heading text-body-md font-semibold text-text">Orderbevestiging zakelijk</h2>
        <p className="mt-1 max-w-2xl text-body-sm text-muted">
          De orderbevestigingsmail voor zakelijke bestellingen (na betaling) beheer je via Mail flows,
          onder het type Zakelijk.
        </p>
        <Link
          href="/admin/marketing/aftersales"
          className="mt-3 inline-flex text-body-sm text-accent-hover underline underline-offset-4"
        >
          Naar Mail flows →
        </Link>
      </div>
    </div>
  );
}
