import Link from "next/link";
import { BannerCreateForm } from "./BannerCreateForm";

export default function NewMarketingBannerPage() {
  return (
    <div>
      <Link href="/admin/marketing/banners" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar banners
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe banner</h1>
        <p className="mt-1 text-body-sm text-muted">
          Maak een nieuwe marketingbanner aan.
        </p>
      </div>
      <div className="mt-8">
        <BannerCreateForm />
      </div>
    </div>
  );
}
