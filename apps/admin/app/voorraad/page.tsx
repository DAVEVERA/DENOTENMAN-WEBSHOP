import { listInventoryItems } from "../../lib/products";

export default async function InventoryPage() {
  const inventory = await listInventoryItems();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Voorraad</p>
        <h1>Voorraadoverzicht</h1>
        <span>Actuele voorraadlabels en SKU&apos;s uit Supabase productvarianten.</span>
      </section>

      <section className="admin-actions">
        <a href="/voorraad/mutaties" className="admin-button admin-button--secondary">
          Mutaties
        </a>
        <a href="/voorraad/import" className="admin-button admin-button--secondary">
          Import
        </a>
      </section>

      <section className="admin-list">
        {inventory.length === 0 ? <p>Geen voorraadrecords gevonden.</p> : null}
        {inventory.map((item) => (
          <a key={`${item.productId}-${item.variantId}`} href={`/producten/${item.productId}/varianten`} className="admin-list-row">
            <div>
              <h2>{item.productName}</h2>
              <p>{item.variantName}</p>
              {item.sku ? <p>SKU: {item.sku}</p> : null}
            </div>

            <span>{item.isActive ? "Actief" : "Verborgen"}</span>
            <strong>{item.stockLabel}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
