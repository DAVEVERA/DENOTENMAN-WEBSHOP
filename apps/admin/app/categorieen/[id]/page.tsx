import { notFound } from "next/navigation";
import {
  formatAdminPrice,
  getAdminCategory,
  listProductsByAdminCategory,
} from "../../../lib/products";

type CategoryDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { id } = await params;
  const [category, products] = await Promise.all([
    getAdminCategory(id),
    listProductsByAdminCategory(id),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Categorie</p>
        <h1>{category.label}</h1>
        <span>Bekijk alle echte producten binnen deze categorie.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Slug</h2>
          <p>{category.id}</p>
        </article>
        <article className="admin-card">
          <h2>Producten</h2>
          <p>{category.productCount}</p>
        </article>
        <article className="admin-card">
          <h2>Actief</h2>
          <p>{category.activeProductCount}</p>
        </article>
      </section>

      <section className="admin-section">
        <h2>Producten</h2>
        <div className="admin-list">
          {products.map((product) => (
            <a key={product.id} href={`/producten/${product.id}`} className="admin-list-row">
              <div className="admin-product-summary">
                {product.image ? <img src={product.image} alt="" /> : null}
                <div>
                  <h2>{product.name}</h2>
                  <p>{product.slug}</p>
                </div>
              </div>
              <span>{formatAdminPrice(product.basePrice)}</span>
              <strong>{product.isActive ? "Actief" : "Verborgen"}</strong>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
