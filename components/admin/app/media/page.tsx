import { listAdminMediaAssets } from "../../lib/media";
import { formatAdminDate } from "../../lib/orders";

function formatSize(bytes: number | null) {
  if (!bytes) return "Onbekend";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage() {
  const assets = await listAdminMediaAssets();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Media</p>
        <h1>Mediabibliotheek</h1>
        <span>Bestanden uit de Supabase Storage bucket `product-images`.</span>
      </section>

      <section className="admin-list">
        {assets.length === 0 ? <p>Geen media gevonden in `product-images`.</p> : null}
        {assets.map((asset) => (
          <a key={`${asset.bucket}-${asset.path}`} href={asset.publicUrl} className="admin-list-row">
            <div>
              <h2>{asset.name}</h2>
              <p>{asset.path}</p>
              <p>{formatAdminDate(asset.updatedAt)}</p>
            </div>
            <span>{formatSize(asset.size)}</span>
            <strong>{asset.bucket}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
