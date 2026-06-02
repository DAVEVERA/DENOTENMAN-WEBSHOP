import Link from "next/link";
import { QRCodeWorkbench } from "../../components/qrcodes/QRCodesWorkbench";
import { listAdminCategories, listAdminProducts } from "../../lib/products";
import { hasQrCodeDesignsTable, listQrCodeDesigns } from "../../lib/qrcodes";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
    "https://www.denotenman.nl"
  );
}

export default async function QrCodesPage() {
  const [products, categories, designs] = await Promise.all([
    listAdminProducts(),
    listAdminCategories(),
    listQrCodeDesigns(),
  ]);
  const hasQrCodeStorage = await hasQrCodeDesignsTable();
  const siteUrl = getSiteUrl();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>QR-codes</h1>
        <span>Maak QR-codes voor producten, acties, WiFi, WhatsApp en printbare stickerlabels.</span>
      </section>

      {!hasQrCodeStorage ? (
        <p className="admin-alert">
          De QR-code database tabel ontbreekt nog. Voer de migratie
          {" "}
          <code>supabase/migrations/035_qr_code_designs.sql</code>
          {" "}
          uit in Supabase voordat opslaan, archiveren en verwijderen werken.
        </p>
      ) : null}

      <QRCodeWorkbench
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

      <section className="admin-section">
        <h2>Opgeslagen QR-codes</h2>
        <div className="admin-list">
          {designs.length === 0 ? <p>Geen QR-codes opgeslagen.</p> : null}
          {designs.map((design) => (
            <Link key={design.id} href={`/qrcodes/${design.id}`} className="admin-list-row">
              <div>
                <h2>{design.name}</h2>
                <p>{design.targetType}</p>
              </div>
              <strong>{design.status === "archived" ? "Gearchiveerd" : "Actief"}</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
