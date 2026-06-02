import { notFound } from "next/navigation";
import {
  deleteProductAction,
  hideProductAction,
  saveProductAction,
  showProductAction,
} from "../../../actions/product.actions";
import {
  formatAdminPrice,
  getAdminProduct,
  listProductWeights,
} from "../../../lib/products";

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const categories = [
  { value: "noten", label: "Noten" },
  { value: "zuidvruchten", label: "Gedroogd fruit" },
  { value: "snacks", label: "Snacks" },
  { value: "zaden-pitten", label: "Pitten & Zaden" },
  { value: "superfoods", label: "Superfood" },
  { value: "overig", label: "Natuurvoeding" },
  { value: "honing", label: "Honing" },
  { value: "mixen", label: "Mixen" },
];

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getAdminProduct(Number(id));

  if (!product) {
    notFound();
  }

  const weights = await listProductWeights(product.id);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Product</p>
        <h1>{product.name}</h1>
        <span>Beheer productgegevens, prijs, media en zichtbaarheid.</span>
      </section>

      <section className="admin-grid admin-grid--two">
        <article className="admin-card">
          <h2>Status</h2>
          <p>Categorie: {product.categoryLabel ?? product.category}</p>
          <p>Prijs: {formatAdminPrice(product.basePrice)}</p>
          <p>Zichtbaar: {product.isActive ? "Ja" : "Nee"}</p>
        </article>

        <article className="admin-card">
          <h2>Gewichten</h2>
          {weights.length > 0 ? (
            <ul className="admin-plain-list">
              {weights.map((weight) => (
                <li key={weight.id}>
                  {weight.label} - {formatAdminPrice(weight.price)}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nog geen gewichten gekoppeld.</p>
          )}
        </article>
      </section>

      <div className="admin-actions">
        <a className="admin-button admin-button--secondary" href={`/producten/${product.id}/varianten`}>
          Gewichten en varianten
        </a>
        <a className="admin-button admin-button--secondary" href={`/producten/${product.id}/media`}>
          Media beheren
        </a>
        <form action={product.isActive ? hideProductAction : showProductAction}>
          <input type="hidden" name="productId" value={product.id} />
          <button className="admin-button admin-button--ghost" type="submit">
            {product.isActive ? "Verbergen" : "Zichtbaar maken"}
          </button>
        </form>
      </div>

      <form className="admin-form admin-form--wide" action={saveProductAction}>
        <input type="hidden" name="id" value={product.id} />

        <label>
          Productnaam
          <input type="text" name="name" defaultValue={product.name} required />
        </label>

        <label>
          Slug
          <input type="text" name="slug" defaultValue={product.slug} required />
        </label>

        <div className="admin-form-grid">
          <label>
            Categorie
            <select name="category" defaultValue={product.category}>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Categorielabel
            <input type="text" name="categoryLabel" defaultValue={product.categoryLabel ?? ""} />
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Basisprijs
            <input
              type="number"
              step="0.01"
              min="0"
              name="basePrice"
              defaultValue={product.basePrice}
              required
            />
          </label>

          <label>
            Eenheid
            <input type="text" name="unit" defaultValue={product.unit ?? ""} />
          </label>
        </div>

        {product.image && (
          <div className="admin-image-preview">
            <img src={product.image} alt="" />
          </div>
        )}

        <label>
          Nieuwe productfoto
          <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" />
        </label>

        <label>
          Foto-URL
          <input type="url" name="image" defaultValue={product.image ?? ""} />
        </label>

        <label>
          Korte omschrijving
          <textarea name="description" defaultValue={product.description ?? ""} />
        </label>

        <div className="admin-form-grid">
          <label>
            Badge
            <input type="text" name="badge" defaultValue={product.badge ?? ""} />
          </label>

          <label>
            Herkomst
            <input type="text" name="origin" defaultValue={product.origin ?? ""} />
          </label>
        </div>

        <label className="admin-checkbox">
          <input type="checkbox" name="isActive" defaultChecked={product.isActive} />
          Zichtbaar in webshop
        </label>

        <button className="admin-button" type="submit">
          Product opslaan
        </button>
      </form>

      <section className="admin-section admin-danger-zone">
        <h2>Product verwijderen</h2>
        <p>
          Verwijder dit product definitief uit de catalogus. Gekoppelde gewichten, varianten,
          voorraadmutaties, zakelijke assortimenten en productfoto&apos;s worden ook verwijderd.
        </p>
        <form className="admin-form admin-form--compact" action={deleteProductAction}>
          <input type="hidden" name="productId" value={product.id} />
          <label>
            Typ VERWIJDEREN om te bevestigen
            <input type="text" name="confirmation" autoComplete="off" required />
          </label>
          <button className="admin-button admin-button--danger" type="submit">
            Product definitief verwijderen
          </button>
        </form>
      </section>
    </main>
  );
}
