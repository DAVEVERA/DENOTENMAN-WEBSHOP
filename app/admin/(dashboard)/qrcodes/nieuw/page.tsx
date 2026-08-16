import Link from "next/link";
import { QrCodeWorkbench } from "@/components/admin-panel/qrcodes/QrCodeWorkbench";
import { getSiteUrl, listQrCategoryOptions, listQrProductOptions } from "@/lib/qrcode-options";

export default async function NewQrCodePage() {
  const [products, categories] = await Promise.all([listQrProductOptions(), listQrCategoryOptions()]);
  const siteUrl = getSiteUrl();

  return (
    <div>
      <Link
        href="/admin/qrcodes"
        className="inline-flex min-h-11 items-center text-body-sm font-semibold text-text underline decoration-accent underline-offset-4"
      >
        ← Terug naar QR-codes
      </Link>

      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe QR-code</h1>
        <p className="mt-1 text-body-sm text-muted">
          Stel het doel en ontwerp in en sla op om de QR-code aan te maken.
        </p>
      </div>

      <div className="mt-8">
        <QrCodeWorkbench
          products={products}
          categories={categories}
          siteUrl={siteUrl}
          brandLogoUrl={`${siteUrl.replace(/\/+$/g, "")}/logo.png`}
        />
      </div>
    </div>
  );
}
