import Image from "next/image";
import Link from "next/link";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { category as categoryPath, product as productPath } from "@/lib/routes";
import { Container } from "@/components/ui/Container";
import { getProductImageStyle } from "@/lib/image-focal";

export function FeaturedBanner({
  products,
  categorySlug,
  locale,
  dictionary,
}: {
  products: ProductSummaryDto[];
  categorySlug: string;
  locale: Locale;
  dictionary: typeof nl;
}) {
  if (products.length === 0) return null;

  return (
    <section className="border-b border-border bg-accent/10">
      <Container className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:items-center sm:gap-8 sm:py-10">
        <div className="text-center sm:shrink-0 sm:text-left">
          <p className="inline-block -rotate-2 rounded-button bg-contrast px-4 py-2 font-heading text-heading-sm font-bold text-background sm:text-heading-md">
            {dictionary.home.fedorsFavorite}
          </p>
          <a
            href={categoryPath(locale, categorySlug)}
            className="mt-3 block font-heading text-body-sm font-semibold text-accent-ink underline decoration-border-hover underline-offset-4 hover:text-contrast"
          >
            {dictionary.home.fedorsFavoriteViewAll}
          </a>
        </div>
        <ul className="flex flex-wrap items-start justify-center gap-4 sm:justify-start sm:gap-6">
          {products.slice(0, 4).map((product) => {
            const image = product.images.find((item) => item.isPrimary) ?? product.images[0];

            return (
              <li key={product.id}>
                <Link
                  href={productPath(locale, product.slug)}
                  className="group flex flex-col items-center gap-2"
                >
                  <span className="relative block h-20 w-20 overflow-hidden rounded-full border-2 border-contrast bg-surface shadow-card transition-transform duration-hover group-hover:scale-105 sm:h-24 sm:w-24">
                    {image ? (
                      <Image
                        src={image.url}
                        alt={image.alt ?? product.name}
                        fill
                        sizes="(max-width: 639px) 80px, 96px"
                        quality={70}
                        style={getProductImageStyle(image.url)}
                        className="product-image-focal h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="line-clamp-2 max-w-24 text-center text-body-sm font-semibold text-text [hyphens:none] [overflow-wrap:normal] [word-break:normal]">
                    {product.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
