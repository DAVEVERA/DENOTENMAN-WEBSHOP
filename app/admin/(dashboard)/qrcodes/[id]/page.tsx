import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QrCodeWorkbench } from "@/components/admin-panel/qrcodes/QrCodeWorkbench";
import { getSiteUrl, listQrCategoryOptions, listQrProductOptions } from "@/lib/qrcode-options";

export default async function QrCodeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [design, products, categories] = await Promise.all([
    prisma.qrCodeDesign.findUnique({ where: { id } }),
    listQrProductOptions(),
    listQrCategoryOptions(),
  ]);

  if (!design) {
    notFound();
  }

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
        <h1 className="text-heading-xl text-text">{design.name}</h1>
        <p className="mt-1 text-body-sm text-muted">
          Pas het doel, ontwerp en labelvel van deze QR-code aan.
        </p>
      </div>

      <div className="mt-8">
        <QrCodeWorkbench
          initialDesign={design}
          products={products}
          categories={categories}
          siteUrl={siteUrl}
          brandLogoUrl={`${siteUrl.replace(/\/+$/g, "")}/logo.png`}
        />
      </div>
    </div>
  );
}
