import Link from "next/link";
import { notFound } from "next/navigation";
import { QRCodeWorkbench } from "../../../components/qrcodes/QRCodesWorkbench";
import { listAdminCategories, listAdminProducts } from "../../../lib/products";
import { getQrCodeDesign } from "../../../lib/qrcodes";

type QrCodeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
    "https://www.denotenman.nl"
  );
}

export default async function QrCodeDetailPage({ params }: QrCodeDetailPageProps) {
  const { id } = await params;
  const [design, products, categories] = await Promise.all([
    getQrCodeDesign(id),
    listAdminProducts(),
    listAdminCategories(),
  ]);

  if (!design) {
    notFound();
  }

  const siteUrl = getSiteUrl();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>QR-code</p>
        <h1>{design.name}</h1>
        <span>Pas het doel, ontwerp en labelvel van deze QR-code aan.</span>
      </section>

      <div className="admin-actions">
        <Link href="/qrcodes" className="admin-button admin-button--secondary">
          Nieuwe QR-code
        </Link>
      </div>

      <QRCodeWorkbench
        initialDesign={design}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          category: product.category,
          categoryLabel: product.categoryLabel,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          label: category.label,
        }))}
        siteUrl={siteUrl}
        brandLogoUrl={`${siteUrl.replace(/\/+$/g, "")}/logo.png`}
      />
    </main>
  );
}
