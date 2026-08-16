import Link from "next/link";
import { NewsletterCreateForm } from "./NewsletterCreateForm";

export default function NewNewsletterCampaignPage() {
  return (
    <div>
      <Link href="/admin/marketing/nieuwsbrieven" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar nieuwsbrieven
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe nieuwsbrief</h1>
        <p className="mt-1 text-body-sm text-muted">
          Stel een nieuwsbriefcampagne samen. Verzenden gebeurt niet automatisch.
        </p>
      </div>
      <div className="mt-8">
        <NewsletterCreateForm />
      </div>
    </div>
  );
}
