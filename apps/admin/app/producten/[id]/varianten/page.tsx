import { notFound } from "next/navigation";
import {
  deleteProductVariantAction,
  deleteProductWeightAction,
  saveProductVariantAction,
  saveProductWeightAction,
} from "../../../../actions/product.actions";
import {
  formatAdminPrice,
  getAdminProduct,
  listProductVariants,
  listProductWeights,
} from "../../../../lib/products";

type ProductVariantsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductVariantsPage({ params }: ProductVariantsPageProps) {
  const { id } = await params;
  const productId = Number(id);
  const product = await getAdminProduct(productId);

  if (!product) {
    notFound();
  }

  const [weights, variants] = await Promise.all([
    listProductWeights(productId),
    listProductVariants(productId),
  ]);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Productvarianten</p>
        <h1>{product.name}</h1>
        <span>Beheer gewichten, prijzen, SKU&apos;s en voorraadlabels.</span>
      </section>

      <section className="admin-grid admin-grid--two">
        <article className="admin-card">
          <h2>Gewichten</h2>
          <div className="admin-stack">
            {weights.map((weight) => (
              <form
                key={weight.id}
                action={deleteProductWeightAction}
                className="admin-inline-row"
              >
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="id" value={weight.id} />
                <span>
                  {weight.label} ({weight.grams}g)
                </span>
                <strong>{formatAdminPrice(weight.price)}</strong>
                <button className="admin-button admin-button--ghost" type="submit">
                  Verwijderen
                </button>
              </form>
            ))}
          </div>

          <form className="admin-form admin-form--compact" action={saveProductWeightAction}>
            <input type="hidden" name="productId" value={product.id} />
            <label>
              Label
              <input type="text" name="label" placeholder="250g" required />
            </label>
            <div className="admin-form-grid">
              <label>
                Gram
                <input type="number" name="grams" min="1" required />
              </label>
              <label>
                Prijs
                <input type="number" name="price" min="0" step="0.01" required />
              </label>
            </div>
            <button className="admin-button" type="submit">
              Gewicht opslaan
            </button>
          </form>
        </article>

        <article className="admin-card">
          <h2>Varianten</h2>
          <div className="admin-stack">
            {variants.map((variant) => (
              <form
                key={variant.id}
                action={deleteProductVariantAction}
                className="admin-inline-row"
              >
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="id" value={variant.id} />
                <span>{variant.name}</span>
                <strong>{formatAdminPrice(variant.price)}</strong>
                <button className="admin-button admin-button--ghost" type="submit">
                  Verwijderen
                </button>
              </form>
            ))}
          </div>

          <form className="admin-form admin-form--compact" action={saveProductVariantAction}>
            <input type="hidden" name="productId" value={product.id} />
            <div className="admin-form-grid">
              <label>
                Variantnaam
                <input type="text" name="name" placeholder="Ongezouten" required />
              </label>
              <label>
                Variantcode
                <input type="text" name="variantId" placeholder="ongezouten" />
              </label>
            </div>
            <div className="admin-form-grid">
              <label>
                Prijs
                <input type="number" name="price" min="0" step="0.01" required />
              </label>
              <label>
                SKU
                <input type="text" name="sku" />
              </label>
            </div>
            <div className="admin-form-grid">
              <label>
                Voorraadstatus
                <select name="stockStatus" defaultValue="in_stock">
                  <option value="in_stock">Op voorraad</option>
                  <option value="limited">Beperkt</option>
                  <option value="out_of_stock">Niet op voorraad</option>
                </select>
              </label>
              <label>
                Voorraadlabel
                <input type="text" name="stockLabel" defaultValue="Op voorraad" />
              </label>
            </div>
            <label>
              Variantfoto URL
              <input type="url" name="image" />
            </label>
            <button className="admin-button" type="submit">
              Variant opslaan
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
