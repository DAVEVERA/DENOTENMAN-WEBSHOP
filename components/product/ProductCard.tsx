"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Heart } from "lucide-react";
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
import { ProductPrice } from "@/components/product/ProductPrice";

export type ProductCardCopy = {
  outOfStock: string;
  addToFavorites: string;
  removeFromFavorites: string;
  orderNow: string;
  moreInfo: string;
  stockAlert: string;
};

const productCardCopies: Record<Locale, ProductCardCopy> = {
  nl: {
    outOfStock: "Niet op voorraad",
    addToFavorites: "Toevoegen aan favorieten",
    removeFromFavorites: "Verwijderen uit favorieten",
    orderNow: "Bestel nu",
    moreInfo: "Meer info",
    stockAlert: "Geef me een seintje",
  },
  en: {
    outOfStock: "Out of stock",
    addToFavorites: "Add to favorites",
    removeFromFavorites: "Remove from favorites",
    orderNow: "Order now",
    moreInfo: "More info",
    stockAlert: "Notify me",
  },
  fr: {
    outOfStock: "Rupture de stock",
    addToFavorites: "Ajouter aux favoris",
    removeFromFavorites: "Retirer des favoris",
    orderNow: "Commander maintenant",
    moreInfo: "Plus d\u2019infos",
    stockAlert: "Pr\u00e9venez-moi",
  },
};

export type ProductCardProduct = CatalogProductDto | ProductSummaryDto;

export function ProductCard({
  product,
  categoryName,
  locale,
  copy,
  compact = false,
}: {
  product: ProductCardProduct;
  categoryName?: string;
  locale: Locale;
  copy?: ProductCardCopy;
  compact?: boolean;
}) {
  const storefront = useStorefrontState();
  const labels = copy ?? productCardCopies[locale];
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const favorite = storefront.favorites.some((item) => item.productId === product.id);

  const favoriteItem: FavoriteItem = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    basePriceCents: product.basePriceCents,
    imageUrl: primaryImage?.url ?? null,
    locale,
  };

  return (
    <Card
      className={cn(
        "group relative flex h-full min-w-0 flex-col overflow-hidden",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-card",
      )}
    >
      {/* Same destination as the CTA below, so it stays out of the tab order
          to avoid a duplicate tab stop per card. */}
      <Link
        href={productPath(locale, product.slug)}
        tabIndex={-1}
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
        {categoryName && !compact ? (
          <span className="mt-3 text-xs text-muted sm:text-body-sm">{categoryName}</span>
        ) : null}
        <span
          className={cn(
            "min-w-0 font-heading font-semibold leading-[1.15] tracking-heading text-text [hyphens:none] [overflow-wrap:normal] [word-break:normal] sm:text-heading-sm",
            compact
              ? "mt-2 line-clamp-2 text-[clamp(0.78rem,3.5vw,1rem)]"
              : "mt-3 line-clamp-3 text-[clamp(0.82rem,3.8vw,1.125rem)]",
          )}
        >
          {product.name}
        </span>
        {product.shortDescription && !compact ? (
          <span className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted sm:text-body-sm">
            {product.shortDescription}
          </span>
        ) : null}
      </Link>

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

      {!product.isActive ? (
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
      ) : null}
      <Link
        href={productPath(locale, product.slug)}
        className={cn(
          compact
            ? "mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-button px-2 text-center font-heading text-xs font-bold text-contrast underline decoration-accent decoration-2 underline-offset-4 transition-colors hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
            : `${productActionButtonClass} mt-3 min-h-11 w-full text-center text-sm max-[420px]:px-2 max-[420px]:text-xs`,
        )}
      >
        <span>{product.isActive ? labels.orderNow : labels.moreInfo}</span>
        <span className="sr-only"> — {product.name}</span>
      </Link>
    </Card>
  );
}
