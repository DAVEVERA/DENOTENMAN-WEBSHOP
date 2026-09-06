"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { product as productPath } from "@/lib/routes";
import { toggleFavorite, useStorefrontState } from "@/lib/storefront-state";

export function FavoritesPanel({
  locale,
  labels,
}: {
  locale: Locale;
  labels: {
    title: string;
    empty: string;
    savedOnDevice: string;
    remove: string;
    viewProduct: string;
  };
}) {
  const { favorites } = useStorefrontState();

  return (
    <section aria-labelledby="favorites-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="favorites-title" className="text-heading-lg">
            {labels.title}
          </h2>
          <p className="mt-1 text-body-sm text-muted">{labels.savedOnDevice}</p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-body-sm text-muted shadow-card">
          {favorites.length}
        </span>
      </div>

      {favorites.length === 0 ? (
        <div className="mt-6 rounded-panel border border-dashed border-border bg-surface p-8 text-center text-muted">
          <Heart className="mx-auto h-8 w-8" aria-hidden="true" />
          <p className="mt-3">{labels.empty}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {favorites.map((item) => (
            <article
              key={item.productId}
              className="relative flex min-w-0 flex-col rounded-card border border-border bg-surface p-3 shadow-card sm:p-card"
            >
              <Link
                href={productPath(item.locale, item.slug)}
                className="min-w-0 flex-1"
              >
                <span className="block aspect-square overflow-hidden rounded-full border border-border bg-background">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : null}
                </span>
                <h3 className="mt-3 line-clamp-3 text-base leading-tight [hyphens:none] [overflow-wrap:normal] [word-break:normal] sm:text-heading-sm">
                  {item.name}
                </h3>
                <p className="mt-1 text-sm font-semibold text-text">
                  {formatPrice(item.basePriceCents, locale)}
                </p>
                <span className="sr-only">{labels.viewProduct}</span>
              </Link>
              <button
                type="button"
                onClick={() => toggleFavorite(item)}
                aria-label={`${labels.remove}: ${item.name}`}
                className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-card"
              >
                <Heart className="h-5 w-5" fill="currentColor" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
