"use client";

import { useMemo, useState } from "react";
import type { StorefrontProduct } from "../../lib/products";
import { ProductCard } from "./ProductCard";

type ProductGridProps = {
  activeCategory?: string;
  initialQuery?: string;
  productLimit?: number;
  products: StorefrontProduct[];
  showFilters?: boolean;
};

function getProductPrice(product: StorefrontProduct) {
  return product.weights.reduce(
    (lowestPrice, weight) => Math.min(lowestPrice, weight.price),
    product.weights[0]?.price ?? product.variants[0]?.price ?? product.basePrice,
  );
}

function getUsableImage(image: string | null) {
  if (!image) return null;
  if (image.startsWith("/assets/")) return null;
  if (image.includes("Gember-Uitgelekt-800x800.jpg")) return null;
  return image;
}

function getStockState(product: StorefrontProduct) {
  const status = product.variants[0]?.stockStatus.toLowerCase() ?? "in_stock";
  const label = product.variants[0]?.stockLabel.toLowerCase() ?? "op voorraad";

  if (status.includes("out") || label.includes("niet")) {
    return "out";
  }

  return "in";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSearchText(product: StorefrontProduct) {
  return normalizeSearchText([
    product.name,
    product.categoryLabel,
    product.description,
    product.origin,
    product.badge,
    product.unit,
    ...product.weights.map((weight) => weight.label),
    ...product.variants.map((variant) => `${variant.name} ${variant.stockLabel}`),
  ]
    .filter(Boolean)
    .join(" "));
}

function getProductTokens(product: StorefrontProduct) {
  return new Set(
    normalizeSearchText(
      [product.name, product.categoryLabel, product.description, product.origin, product.badge]
        .filter(Boolean)
        .join(" "),
    )
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );
}

function getRelatedProducts(product: StorefrontProduct, products: StorefrontProduct[]) {
  const productTokens = getProductTokens(product);
  const productPrice = getProductPrice(product);

  return products
    .filter((item) => item.slug !== product.slug)
    .map((item) => {
      const itemTokens = getProductTokens(item);
      const sharedTokens = [...productTokens].filter((token) => itemTokens.has(token)).length;
      const itemPrice = getProductPrice(item);
      const priceDistance = Math.abs(productPrice - itemPrice);
      const sameCategory = item.category === product.category ? 12 : 0;
      const inStock = getStockState(item) === "in" ? 2 : -8;
      const hasImage = getUsableImage(item.image) ? 1 : 0;
      const closePrice = Math.max(0, 4 - Math.min(priceDistance, 4));

      return {
        item,
        score: sameCategory + sharedTokens * 3 + inStock + hasImage + closePrice,
      };
    })
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, "nl"))
    .slice(0, 6)
    .map(({ item }) => item);
}

export function ProductGrid({
  activeCategory = "all",
  initialQuery = "",
  productLimit,
  products,
  showFilters = false,
}: ProductGridProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(activeCategory);
  const [stock, setStock] = useState("all");
  const [unit, setUnit] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("popular");

  const firstFallbackImage = useMemo(
    () => getUsableImage(products.find((product) => getUsableImage(product.image))?.image ?? null),
    [products],
  );
  const units = useMemo(
    () =>
      [
        ...new Set(
          products.flatMap((product) =>
            product.weights.length > 0 ? product.weights.map((weight) => weight.label) : [product.unit ?? "Per stuk"],
          ),
        ),
      ].sort((left, right) => left.localeCompare(right, "nl")),
    [products],
  );
  const fallbackImagesByCategory = useMemo(() => {
    const images = new Map<string, string>();

    for (const product of products) {
      const image = getUsableImage(product.image);

      if (image && !images.has(product.category)) {
        images.set(product.category, image);
      }
    }

    return images;
  }, [products]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);

    return products
      .filter((product) => category === "all" || product.category === category)
      .filter((product) => !normalizedQuery || getSearchText(product).includes(normalizedQuery))
      .filter((product) => stock === "all" || getStockState(product) === stock)
      .filter((product) => {
        if (unit === "all") return true;
        if (product.weights.length === 0) return (product.unit ?? "Per stuk") === unit;
        return product.weights.some((weight) => weight.label === unit);
      })
      .filter((product) => {
        const productPrice = getProductPrice(product);
        if (price === "under-3") return productPrice < 3;
        if (price === "3-5") return productPrice >= 3 && productPrice <= 5;
        if (price === "over-5") return productPrice > 5;
        return true;
      })
      .sort((left, right) => {
        if (sort === "price-asc") return getProductPrice(left) - getProductPrice(right);
        if (sort === "price-desc") return getProductPrice(right) - getProductPrice(left);
        if (sort === "name") return left.name.localeCompare(right.name, "nl");
        return left.categoryLabel.localeCompare(right.categoryLabel, "nl") || left.name.localeCompare(right.name, "nl");
      });
  }, [category, price, products, query, sort, stock, unit]);

  return (
    <section className="product-browser">
      {showFilters && (
        <div className="product-browser__filters" aria-label="Producten zoeken en filteren">
          <form
            className="product-browser__compact-controls"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="product-browser__search">
              <span>Zoek in assortiment</span>
              <span className="product-browser__search-field">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Zoek noten, zaden, fruit..."
                  autoComplete="off"
                  aria-describedby="product-search-status"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} aria-label="Zoekterm wissen">
                    Wissen
                  </button>
                ) : null}
              </span>
            </label>

            <label>
              <span>Sorteer</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="popular">Populair</option>
                <option value="name">Naam A-Z</option>
                <option value="price-asc">Prijs laag-hoog</option>
                <option value="price-desc">Prijs hoog-laag</option>
              </select>
            </label>

            <details className="product-browser__advanced">
              <summary>Filters</summary>
              <div className="product-browser__advanced-panel">
                <label>
                  <span>Voorraad</span>
                  <select value={stock} onChange={(event) => setStock(event.target.value)}>
                    <option value="all">Alles</option>
                    <option value="in">Op voorraad</option>
                    <option value="out">Niet op voorraad</option>
                  </select>
                </label>

                <label>
                  <span>Eenheid</span>
                  <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                    <option value="all">Alle eenheden</option>
                    {units.map((unitLabel) => (
                      <option key={unitLabel} value={unitLabel}>
                        {unitLabel}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Prijs</span>
                  <select value={price} onChange={(event) => setPrice(event.target.value)}>
                    <option value="all">Alle prijzen</option>
                    <option value="under-3">Onder EUR 3</option>
                    <option value="3-5">EUR 3 tot EUR 5</option>
                    <option value="over-5">Boven EUR 5</option>
                  </select>
                </label>
              </div>
            </details>
          </form>

          <div className="product-browser__meta">
            <span id="product-search-status" aria-live="polite">
              <strong>{filteredProducts.length}</strong>{" "}
              <span>producten gevonden</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(activeCategory);
                setStock("all");
                setUnit("all");
                setPrice("all");
                setSort("popular");
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <div className="product-grid">
        {filteredProducts.slice(0, productLimit).map((product) => {
          const relatedProducts = getRelatedProducts(product, products);

          return (
            <ProductCard
              key={product.slug}
              product={product}
              fallbackImage={fallbackImagesByCategory.get(product.category) ?? firstFallbackImage}
              relatedProducts={relatedProducts}
            />
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <p className="product-browser__empty">Geen producten gevonden. Pas je zoekterm of filters aan.</p>
      )}
    </section>
  );
}
