import Link from "next/link";
import { listAdminCategories } from "../../lib/products";

export default async function CategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Catalogus</p>
        <h1>Categorieen</h1>
        <span>Categorieen afgeleid uit de echte Supabase productcatalogus.</span>
      </section>

      <section className="admin-actions">
        <Link href="/categorieen/nieuw" className="admin-button">
          Nieuwe categorie
        </Link>
      </section>

      <section className="admin-list">
        {categories.length === 0 ? <p>Geen categorieen gevonden.</p> : null}
        {categories.map((category) => (
          <Link key={category.id} href={`/categorieen/${category.id}`} className="admin-list-row">
            <div>
              <h2>{category.label}</h2>
              <p>Slug: {category.id}</p>
            </div>
            <span>{category.activeProductCount} actief</span>
            <strong>{category.productCount} producten</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
