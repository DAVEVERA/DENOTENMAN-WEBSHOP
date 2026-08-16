import Link from "next/link";
import { CampaignCreateForm } from "./CampaignCreateForm";

export default function NewMarketingCampaignPage() {
  return (
    <div>
      <Link href="/admin/marketing/acties" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar acties
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe actie</h1>
        <p className="mt-1 text-body-sm text-muted">
          Maak een nieuwe marketingactie aan.
        </p>
      </div>
      <div className="mt-8">
        <CampaignCreateForm />
      </div>
    </div>
  );
}
