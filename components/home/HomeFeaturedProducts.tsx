"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import type { ProductCardCopy } from "@/components/product/ProductCard";
import type { ProductQuickViewCopy } from "@/components/product/ProductQuickView";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

export type HomeFeaturedProductsCopy = {
  eyebrow?: string;
  title: string;
  intro: string;
  viewAll: string;
  loadMore?: string;
  showLess?: string;
  card: ProductCardCopy;
  quickView: ProductQuickViewCopy;
};

export function HomeFeaturedProducts({
  products,
  locale,
  href,
  copy,
  sectionId,
}: {
  products: ProductSummaryDto[];
  locale: Locale;
  href: string;
  copy: HomeFeaturedProductsCopy;
  sectionId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (products.length === 0) return null;

  const canExpand = products.length > 4 && copy.loadMore && copy.showLess;
  const listId = `${sectionId}-products`;

  return (
    <section
      data-home-section={sectionId}
      className="bg-transparent py-12 sm:py-16 lg:py-20"
      aria-labelledby={`${sectionId}-title`}
    >
      <Container
        fullWidth
        className="px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-16"
      >
        <div className="max-w-2xl">
          {copy.eyebrow ? (
            <p className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-accent-ink">
              {copy.eyebrow}
            </p>
          ) : null}
          <h2
            id={`${sectionId}-title`}
            className={cn(
              "font-heading text-3xl font-bold tracking-heading text-text sm:text-4xl",
              copy.eyebrow && "mt-3",
            )}
          >
            {copy.title}
          </h2>
          <p className="mt-3 text-body-md leading-relaxed text-muted">{copy.intro}</p>
        </div>

        <ul
          id={listId}
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:gap-6 xl:grid-cols-6"
        >
          {products.map((product, index) => (
            <li
              key={product.id}
              className={cn(
                "min-w-0",
                index >= 4 && !expanded && "hidden md:block",
              )}
            >
              <ProductCard
                product={product}
                locale={locale}
                copy={copy.card}
                quickViewCopy={copy.quickView}
                compact
              />
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 min-[480px]:flex-row min-[480px]:items-center">
          <Link
            href={href}
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-6 py-3 font-heading text-body-md font-bold text-contrast shadow-button transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
          >
            {copy.viewAll}
          </Link>
          {canExpand ? (
            <button
              type="button"
              aria-controls={listId}
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-border-hover bg-white px-6 py-3 font-heading text-body-md font-bold text-contrast transition-colors hover:bg-[#f1ece3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast md:hidden"
            >
              {expanded ? copy.showLess : copy.loadMore}
            </button>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
