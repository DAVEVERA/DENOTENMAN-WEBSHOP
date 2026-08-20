"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Heart, ShoppingCart } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { CatalogProductDto, ProductSummaryDto } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { getProductImageStyle } from "@/lib/image-focal";
import { productActionButtonClass } from "@/lib/product-action-button";
import {
  toggleFavorite,
  useStorefrontState,
  type FavoriteItem,
} from "@/lib/storefront-state";
import { Card } from "@/components/ui/Card";
import {
  ProductQuickView,
  type ProductQuickViewCopy,
} from "@/components/product/ProductQuickView";
import { ProductPrice } from "@/components/product/ProductPrice";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

export type ProductCardCopy = {
  outOfStock: string;
  addToFavorites: string;
  removeFromFavorites: string;
  openQuickView: string;
  quickOrder: string;
  moreInfo: string;
  stockAlert: string;
  loadingQuickView: string;
};

const productCardCopies: Record<Locale, ProductCardCopy> = {
  nl: {
    outOfStock: "Niet op voorraad",
    addToFavorites: "Toevoegen aan favorieten",
    removeFromFavorites: "Verwijderen uit favorieten",
    openQuickView: "Open snelle productinformatie voor {product}",
    quickOrder: "Snel bestellen",
    moreInfo: "Meer info",
    stockAlert: "Geef me een seintje",
    loadingQuickView: "Product laden\u2026",
  },
  en: {
    outOfStock: "Out of stock",
    addToFavorites: "Add to favorites",
    removeFromFavorites: "Remove from favorites",
    openQuickView: "Open quick product information for {product}",
    quickOrder: "Quick order",
    moreInfo: "More info",
    stockAlert: "Notify me",
    loadingQuickView: "Loading product\u2026",
  },
  fr: {
    outOfStock: "Rupture de stock",
    addToFavorites: "Ajouter aux favoris",
    removeFromFavorites: "Retirer des favoris",
    openQuickView: "Ouvrir les informations rapides pour {product}",
    quickOrder: "Commander rapidement",
    moreInfo: "Plus d\u2019infos",
    stockAlert: "Pr\u00e9venez-moi",
    loadingQuickView: "Chargement du produit\u2026",
  },
};

export type ProductCardProduct = CatalogProductDto | ProductSummaryDto;

export function ProductCard({
  product,
  categoryName,
  locale,
  copy,
  quickViewCopy,
  quickViewLoading = false,
  onQuickView,
}: {
  product: ProductCardProduct;
  categoryName?: string;
  locale: Locale;
  copy?: ProductCardCopy;
  quickViewCopy?: ProductQuickViewCopy;
  quickViewLoading?: boolean;
  onQuickView?: (product: ProductCardProduct) => void;
}) {
  const [localQuickViewOpen, setLocalQuickViewOpen] = useState(false);
  const storefront = useStorefrontState();
  const labels = copy ?? productCardCopies[locale];
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const favorite = storefront.favorites.some((item) => item.productId === product.id);

  function openQuickView() {
    if (onQuickView) {
      onQuickView(product);
      return;
    }
    setLocalQuickViewOpen(true);
  }

  const favoriteItem: FavoriteItem = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    basePriceCents: product.basePriceCents,
    imageUrl: primaryImage?.url ?? null,
    locale,
  };

  return (
    <>
      <Card
        className="group relative flex h-full min-w-0 cursor-pointer flex-col overflow-hidden p-3 sm:p-card"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a")) return;
          openQuickView();
        }}
      >
        <button
          type="button"
          onClick={openQuickView}
          aria-label={labels.openQuickView.replace("{product}", product.name)}
          className="flex min-w-0 flex-1 flex-col text-left focus-visible:rounded-card"
        >
          <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full border border-border bg-background">
            {primaryImage ? (
              <Image
                src={primaryImage.url}
                alt={primaryImage.alt ?? product.name}
                fill
                sizes="(max-width: 639px) calc(50vw - 1.5rem), (max-width: 1023px) calc(33vw - 2rem), 280px"
                quality={70}
                style={getProductImageStyle(primaryImage.url)}
                className="product-image-focal product-image-focal--zoomable h-full w-full rounded-full object-cover transition-transform duration-hover"
              />
            ) : (
              <span className="block h-full w-full rounded-full bg-background" aria-hidden="true" />
            )}
          </span>
          {categoryName ? (
            <span className="mt-3 text-xs text-muted sm:text-body-sm">{categoryName}</span>
          ) : null}
          <span className="mt-3 line-clamp-3 min-w-0 font-heading text-[clamp(0.82rem,3.8vw,1.125rem)] font-semibold leading-[1.15] tracking-heading text-text [hyphens:auto] [overflow-wrap:break-word] sm:text-heading-sm">
            {product.name}
          </span>
          {product.shortDescription ? (
            <span className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted sm:text-body-sm">
              {product.shortDescription}
            </span>
          ) : null}
        </button>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            {!product.isActive ? (
              <span className="block text-xs font-semibold text-red-600">
                {labels.outOfStock}
              </span>
            ) : null}
            <ProductPrice product={product} locale={locale} />
          </div>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? labels.removeFromFavorites : labels.addToFavorites}
            onClick={() => toggleFavorite(favoriteItem)}
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition-colors duration-hover-fast hover:border-border-hover hover:text-red-600",
              favorite && "border-red-200 bg-red-50 text-red-600"
            )}
          >
            <Heart
              className="h-5 w-5"
              fill={favorite ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
        </div>

        {product.isActive ? (
          <button
            type="button"
            aria-label={labels.openQuickView.replace("{product}", product.name)}
            aria-busy={quickViewLoading}
            disabled={quickViewLoading}
            onClick={openQuickView}
            className={cn(
              productActionButtonClass,
              "mt-3 min-h-11 w-full text-sm max-[420px]:px-2 max-[420px]:text-xs"
            )}
          >
            {quickViewLoading ? <LoadingIndicator size="sm" decorative /> : <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {quickViewLoading ? labels.loadingQuickView : labels.quickOrder}
          </button>
        ) : (
          <Link
            href={productPath(locale, product.slug)}
            className={cn(
              productActionButtonClass,
              "mt-3 min-h-11 w-full text-sm max-[420px]:px-2 max-[420px]:text-xs"
            )}
          >
            <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
            {labels.stockAlert}
          </Link>
        )}
        <Link
          href={productPath(locale, product.slug)}
          className={`${productActionButtonClass} mt-3 min-h-11 w-full text-center text-sm max-[420px]:px-2 max-[420px]:text-xs`}
        >
          <span>{labels.moreInfo}</span>
          <span className="sr-only"> — {product.name}</span>
        </Link>
      </Card>

      {!onQuickView && "variants" in product ? (
        <ProductQuickView
          open={localQuickViewOpen}
          onClose={() => setLocalQuickViewOpen(false)}
          product={product}
          locale={locale}
          copy={quickViewCopy}
        />
      ) : null}
    </>
  );
}
