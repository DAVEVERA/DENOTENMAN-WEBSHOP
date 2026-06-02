import { Icon } from "../ui/Icon";
import { addToCartAction, buyNowAction } from "../../actions/cart.actions";
import type { StorefrontProduct } from "../../lib/products";
import { formatPrice } from "../../lib/products";
import { ProductImage } from "./ProductImage";
import { QuickAddForm } from "./QuickAddForm";

type ProductCardProps = {
  product: StorefrontProduct;
  fallbackImage?: string | null;
  relatedProducts: StorefrontProduct[];
};

function getStockLabel(product: StorefrontProduct) {
  return product.variants[0]?.stockLabel ?? "Op voorraad";
}

function getSeoDescription(product: StorefrontProduct) {
  if (product.description) {
    const description = cleanProductText(product.description);

    if (description.toLowerCase() === product.name.toLowerCase()) {
      return "";
    }

    return description;
  }

  return "";
}

function getProductInfoText(product: StorefrontProduct, description: string) {
  if (description) {
    return description;
  }

  const parts = [
    product.categoryLabel ? `Categorie: ${product.categoryLabel}.` : null,
    product.origin ? `Herkomst: ${product.origin}.` : null,
    product.weights.length > 0
      ? `Beschikbaar in ${product.weights.map((weight) => weight.label).join(", ")}.`
      : product.unit
        ? `Besteleenheid: ${product.unit}.`
        : null,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(" ")
    : "Dagvers geselecteerd product uit het assortiment van De Notenman.";
}

function getUsableImage(image: string | null) {
  if (!image) return null;
  if (image.startsWith("/assets/")) return null;
  if (image.includes("Gember-Uitgelekt-800x800.jpg")) return null;
  return image;
}

function getStartingWeight(product: StorefrontProduct) {
  return product.weights.reduce<StorefrontProduct["weights"][number] | undefined>((lowestWeight, weight) => {
    if (!lowestWeight || weight.price < lowestWeight.price) {
      return weight;
    }

    return lowestWeight;
  }, undefined);
}

function getStartingPrice(product: StorefrontProduct) {
  return getStartingWeight(product)?.price ?? product.variants[0]?.price ?? product.basePrice;
}

function getStartingUnitLabel(product: StorefrontProduct, weight: StorefrontProduct["weights"][number] | undefined) {
  if (weight) {
    return `per ${weight.label}`;
  }

  if (product.unit?.toLowerCase().startsWith("per ")) {
    return product.unit;
  }

  return `per ${product.unit ?? "stuk"}`;
}

function cleanProductText(text: string) {
  return text.replace(/^\s*ingredienten?\s*:\s*/i, "").trim();
}

function getDisplayUnits(product: StorefrontProduct) {
  return [...product.weights].sort((left, right) => left.grams - right.grams);
}

export function ProductCard({ product, fallbackImage = null, relatedProducts }: ProductCardProps) {
  const stockLabel = getStockLabel(product);
  const defaultWeight = getStartingWeight(product);
  const defaultVariant = product.variants[0];
  const displayedPrice = formatPrice(getStartingPrice(product));
  const displayedUnit = getStartingUnitLabel(product, defaultWeight);
  const description = getSeoDescription(product);
  const productInfo = getProductInfoText(product, description);
  const popoutId = `product-popout-${product.slug}`;
  const hasNewBadge = product.badge?.toLowerCase().includes("nieuw") ?? false;
  const image = getUsableImage(product.image) ?? getUsableImage(defaultVariant?.image ?? null) ?? fallbackImage;
  const displayUnits = getDisplayUnits(product);

  return (
    <article className="product-card-shell product-card">
      {hasNewBadge ? <span className="product-card__badge">Nieuw</span> : null}

      <div className="product-card__media">
        <ProductImage alt="" className="product-card-image" src={image} fallbackSrc={fallbackImage} />
        <span className="product-card__quick-actions" aria-label={`${product.name} snel bekijken`}>
          <button
            className="product-card__inspect"
            type="button"
            popoverTarget={popoutId}
            aria-label={`${product.name} snel bekijken`}
          >
            <Icon name="search_loop" className="product-card__inspect-icon" />
          </button>
        </span>
      </div>

      <button className="product-card__open" type="button" popoverTarget={popoutId}>
        <span className="product-card__name">{product.name}</span>
      </button>

      <div className="product-card__footer">
        <span className="product-card__price">
          <span className="product-card__price-main">
            <small className="product-card__price-prefix">Vanaf </small>
            {displayedPrice}
          </span>
          <small className="product-card__price-unit"> {displayedUnit}</small>
        </span>
        <QuickAddForm
          ariaLabel={`${product.name} toevoegen aan winkelwagen`}
          buttonLabel=""
          className="quick-add-form--card"
          iconName="shopping-basket"
          slug={product.slug}
          statusId={`${product.slug}-card-quick-status`}
          variantId={defaultVariant?.variantId}
          weightId={defaultWeight?.id}
        />
      </div>

      <div
        className="product-popout"
        id={popoutId}
        popover="auto"
        role="dialog"
        aria-label={`${product.name} bestellen`}
      >
        <button
          className="product-popout__close"
          type="button"
          popoverTarget={popoutId}
          popoverTargetAction="hide"
          aria-label="Sluiten"
        >
          <Icon name="x" />
        </button>

        <div className="product-popout__media">
          <ProductImage alt={product.name} src={image} fallbackSrc={fallbackImage} />
        </div>

        <div className="product-popout__content">
          <div className="product-popout__summary">
            <h2>{product.name}</h2>
          </div>

          <form className="product-popout__order-form" action={addToCartAction}>
            <input type="hidden" name="slug" value={product.slug} />
            {defaultVariant && <input type="hidden" name="variantId" value={defaultVariant.variantId} />}

            <details className="product-popout__info">
              <summary>Productinformatie</summary>
              <p>{productInfo}</p>
            </details>

            <fieldset className="product-unit-tiles product-unit-tiles--compact">
              <legend>Besteleenheid</legend>
              {displayUnits.map((unit) => (
                <label
                  key={unit.id}
                  className="product-unit-tile"
                >
                  <input
                    type="radio"
                    name="weightId"
                    value={unit.id}
                    defaultChecked={unit.id === defaultWeight?.id}
                  />
                  <span>
                    <Icon name="product_pack" />
                    <strong>{unit.label}</strong>
                    <small>{formatPrice(unit.price)}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="form-field">
              <span>Aantal</span>
              <input type="number" name="quantity" defaultValue={1} min={1} />
            </label>

            <div className="product-popout__ctas">
              <button className="button button--primary" type="submit">
                <Icon name="Submit_cart" />
                In winkelwagen
              </button>
              <button className="button button--secondary" type="submit" formAction={buyNowAction}>
                <Icon name="checkout" />
                Gelijk bestellen
              </button>
            </div>
          </form>

          <dl className="product-popout__facts">
            <div>
              <dt>
                <Icon name="in_stock" />
                Voorraad
              </dt>
              <dd>{stockLabel}</dd>
            </div>
            <div>
              <dt>
                <Icon name="price_tag" />
                Vanaf
              </dt>
              <dd>
                {displayedPrice}
                <small>{displayedUnit}</small>
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="order_unit" />
                Besteleenheden
              </dt>
              <dd>
                {product.weights.length > 0
                  ? product.weights.map((weight) => weight.label).join(", ")
                  : product.unit ?? "Per stuk"}
              </dd>
            </div>
          </dl>

          {relatedProducts.length > 0 && (
            <section className="product-popout__related" aria-label="Vaak samen gekocht">
              <h3>Vaak samen gekocht</h3>
              <div className="product-popout__slider">
                {relatedProducts.map((relatedProduct) => {
                  const relatedStartingWeight = getStartingWeight(relatedProduct);

                  return (
                    <article key={relatedProduct.slug} className="product-popout__related-card">
                      <span className="product-popout__related-image">
                        <ProductImage alt="" src={getUsableImage(relatedProduct.image) ?? fallbackImage} />
                      </span>
                      <strong>{relatedProduct.name}</strong>
                      <span>{formatPrice(getStartingPrice(relatedProduct))}</span>
                      <QuickAddForm
                        buttonLabel="Toevoegen"
                        className="quick-add-form--related"
                        slug={relatedProduct.slug}
                        statusId={`${product.slug}-${relatedProduct.slug}-related-quick-status`}
                        variantId={relatedProduct.variants[0]?.variantId}
                        weightId={relatedStartingWeight?.id}
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
