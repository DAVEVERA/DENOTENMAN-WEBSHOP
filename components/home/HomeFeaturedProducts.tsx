"use client";

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
  card: ProductCardCopy;
  quickView: ProductQuickViewCopy;
};

export function HomeFeaturedProducts({
  products,
  locale,
  href,
  copy,
  sectionId,
  layout = "rail",
  tone = "surface",
}: {
  products: ProductSummaryDto[];
  locale: Locale;
  href: string;
  copy: HomeFeaturedProductsCopy;
  sectionId: string;
  layout?: "rail" | "grid";
  tone?:
    | "surface"
    | "warm"
    | "plain"
    | "from-craft"
    | "from-honey"
    | "from-nut-butter";
}) {
  if (products.length === 0) return null;

  return (
    <section
      className={cn(
        "py-12 sm:py-16 lg:py-20",
        tone === "surface" && "bg-surface",
        tone === "warm" && "bg-[#f3eee5]",
        tone === "plain" && "bg-background",
        tone === "from-craft" &&
          "bg-[linear-gradient(180deg,#f3eee5_0%,#f8f5ef_7rem,#f8f5ef_100%)]",
        tone === "from-honey" &&
          "bg-[linear-gradient(180deg,#f4efe6_0%,#f8f5ef_7rem,#f8f5ef_100%)]",
        tone === "from-nut-butter" &&
          "bg-[linear-gradient(180deg,#efe8dc_0%,#faf8f4_7rem,#faf8f4_100%)]",
      )}
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
          className={cn(
            "mt-8 gap-4 sm:gap-6",
            layout === "rail" &&
              "-mx-4 flex snap-x snap-mandatory scroll-px-4 overscroll-x-contain overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3",
            layout === "grid" &&
              "grid grid-cols-1 min-[390px]:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {products.map((product) => (
            <li
              key={product.id}
              className={cn(
                "min-w-0",
                layout === "rail" &&
                  "w-[min(82vw,19rem)] shrink-0 snap-start sm:w-auto",
              )}
            >
              <ProductCard
                product={product}
                categoryName={product.category?.name}
                locale={locale}
                copy={copy.card}
                quickViewCopy={copy.quickView}
              />
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-6 py-3 font-heading text-body-md font-bold text-contrast shadow-button transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
          >
            {copy.viewAll}
          </Link>
        </div>
      </Container>
    </section>
  );
}
