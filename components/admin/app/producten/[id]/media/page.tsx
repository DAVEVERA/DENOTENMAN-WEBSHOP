import { notFound } from "next/navigation";
import {
  deleteProductMediaAction,
  setPrimaryProductMediaAction,
  updateProductMediaAction,
  uploadProductMediaAction,
} from "../../../../actions/media.actions";
import { getAdminProduct, listProductMedia } from "../../../../lib/products";

type ProductMediaPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductMediaPage({ params }: ProductMediaPageProps) {
  const { id } = await params;
  const product = await getAdminProduct(Number(id));

  if (!product) {
    notFound();
  }

  const mediaItems = await listProductMedia(product.id);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Productmedia</p>
        <h1>{product.name}</h1>
        <span>Upload een nieuwe hoofdafbeelding voor de productpagina.</span>
      </section>

      <section className="admin-media-grid">
        {mediaItems.length === 0 ? <p>Nog geen productfoto&apos;s gekoppeld.</p> : null}
        {mediaItems.map((item) => (
          <article key={item.id} className="admin-card admin-media-card">
            <img src={item.publicUrl} alt={item.altText ?? ""} />
            <form className="admin-form admin-form--compact" action={updateProductMediaAction}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="mediaId" value={item.id} />
              <label>
                Alt-tekst
                <input type="text" name="altText" defaultValue={item.altText ?? ""} />
              </label>
              <label>
                Volgorde
                <input type="number" name="sortOrder" defaultValue={item.sortOrder} />
              </label>
              <button className="admin-button admin-button--secondary" type="submit">
                Foto bijwerken
              </button>
            </form>
            <div className="admin-actions">
              <form action={setPrimaryProductMediaAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="mediaId" value={item.id} />
                <button className="admin-button" type="submit" disabled={item.isPrimary}>
                  {item.isPrimary ? "Hoofdfoto" : "Maak hoofdfoto"}
                </button>
              </form>
              <form action={deleteProductMediaAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="mediaId" value={item.id} />
                <button className="admin-button admin-button--ghost" type="submit">
                  Verwijderen
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>

      <form className="admin-form admin-section" action={uploadProductMediaAction}>
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="slug" value={product.slug} />

        <label>
          Nieuwe productfoto
          <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" required />
        </label>

        <button className="admin-button" type="submit">
          Foto uploaden
        </button>
      </form>
    </main>
  );
}
