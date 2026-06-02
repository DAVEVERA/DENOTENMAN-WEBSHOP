import Link from "next/link";
import { formatAdminPrice, listAdminProducts } from "../../lib/products";

type AdminProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim() : "";
  const products = await listAdminProducts(query);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Catalogus</p>
        <h1>Producten</h1>
        <span>Beheer producten, prijzen, media en zichtbaarheid in de webshop.</span>
      </section>

      <div className="admin-actions">
        <Link href="/producten/nieuw" className="admin-button">
          Nieuw product
        </Link>
      </div>

      <form className="admin-search-form" role="search">
        <label>
          <span>Zoeken</span>
          <input
            type="search"
            name="q"
            placeholder="Zoek op product, slug of categorie"
            defaultValue={query}
            autoComplete="off"
          />
        </label>
        <button className="admin-button" type="submit">
          Zoeken
        </button>
        {query ? (
          <Link className="admin-button admin-button--secondary" href="/producten">
            Wissen
          </Link>
        ) : null}
      </form>

      {query ? (
        <p className="admin-muted">
          {products.length} resultaat{products.length === 1 ? "" : "en"} voor &quot;{query}&quot;.
        </p>
      ) : null}

      <section className="admin-list">
        {products.length === 0 ? <p>Geen producten gevonden.</p> : null}
        {products.map((product) => (
          <Link key={product.id} href={`/producten/${product.id}`} className="admin-list-row">
            <div className="admin-product-summary">
              {product.image && <img src={product.image} alt="" />}
              <div>
                <h2>{product.name}</h2>
                <p>{product.categoryLabel ?? product.category}</p>
              </div>
            </div>

            <span>{formatAdminPrice(product.basePrice)}</span>
            <strong>{product.isActive ? "Actief" : "Verborgen"}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
