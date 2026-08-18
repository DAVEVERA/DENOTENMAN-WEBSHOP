"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Bell, Heart, ShoppingCart } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
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
import { ProductQuickView } from "@/components/product/ProductQuickView";
import { ProductPrice } from "@/components/product/ProductPrice";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };
const stockAlertLabel = { nl: "Geef me een seintje", en: "Notify me", fr: "Prévenez-moi" } as const;

export function ProductCard({
  product,
  categoryName,
  locale,
}: {
  product: ProductSummaryDto;
  categoryName?: string;
  locale: Locale;
}) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const storefront = useStorefrontState();
  const dictionary = dictionaries[locale];
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const favorite = storefront.favorites.some((item) => item.productId === product.id);
  const openQuickView = useCallback(() => setQuickViewOpen(true), []);
  const closeQuickView = useCallback(() => setQuickViewOpen(false), []);

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
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden p-3 sm:p-card"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a")) return;
          openQuickView();
        }}
      >
        <button
          type="button"
          onClick={openQuickView}
          aria-label={dictionary.product.openQuickView.replace("{product}", product.name)}
          className="flex min-w-0 flex-1 flex-col text-left focus-visible:rounded-card"
        >
          <span className="mx-auto block aspect-square w-full overflow-hidden rounded-full border border-border bg-background">
            {primaryImage ? (
              <img
                src={primaryImage.url}
                alt={primaryImage.alt ?? product.name}
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
                {dictionary.product.outOfStock}
              </span>
            ) : null}
            <ProductPrice product={product} locale={locale} />
          </div>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={
              favorite
                ? dictionary.product.removeFromFavorites
                : dictionary.product.addToFavorites
            }
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
          <button type="button" aria-label={dictionary.product.openQuickView.replace("{product}", product.name)} onClick={openQuickView} className={cn(productActionButtonClass, "mt-3 w-full text-sm max-[420px]:px-2 max-[420px]:text-xs")}>
            <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
            {dictionary.product.quickOrder}
          </button>
        ) : (
          <Link href={productPath(locale, product.slug)} className={cn(productActionButtonClass, "mt-3 w-full text-sm max-[420px]:px-2 max-[420px]:text-xs")}>
            <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
            {stockAlertLabel[locale]}
          </Link>
        )}
        <Link
          href={productPath(locale, product.slug)}
          className={`${productActionButtonClass} mt-3 w-full text-center text-sm max-[420px]:px-2 max-[420px]:text-xs`}
        >
          {dictionary.product.moreInfo}
        </Link>
      </Card>

      <ProductQuickView
        open={quickViewOpen}
        onClose={closeQuickView}
        product={product}
        locale={locale}
      />
    </>
  );
}
