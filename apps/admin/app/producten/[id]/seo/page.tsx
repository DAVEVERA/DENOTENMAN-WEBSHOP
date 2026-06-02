import { notFound } from "next/navigation";
import { getAdminProduct } from "../../../../lib/products";

type ProductSeoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductSeoPage({ params }: ProductSeoPageProps) {
  const { id } = await params;
  const product = await getAdminProduct(Number(id));

  if (!product) {
    notFound();
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Product SEO</p>
        <h1>{product.name}</h1>
        <span>SEO-preview op basis van echte productdata. Opslaan naar aparte SEO-tabel volgt zodra die opslag bestaat.</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <h2>Titelvoorstel</h2>
          <p>{product.name} kopen bij De Notenman</p>
        </article>
        <article className="admin-card">
          <h2>Slug</h2>
          <p>{product.slug}</p>
        </article>
        <article className="admin-card">
          <h2>Omschrijving</h2>
          <p>{product.description ?? "Geen productomschrijving ingevuld."}</p>
        </article>
      </section>
    </main>
  );
}
