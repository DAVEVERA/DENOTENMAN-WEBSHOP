import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ProductCard({
  product,
  categoryName,
  locale,
}: {
  product: ProductSummaryDto;
  categoryName?: string;
  locale: Locale;
}) {
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  return (
    <a
      href={productPath(locale, product.slug)}
      className="block rounded-lg border border-border bg-surface p-4 transition hover:shadow-md"
    >
      {primaryImage ? (
        <img
          src={primaryImage.url}
          alt={primaryImage.alt ?? product.name}
          className="aspect-square w-full rounded object-cover"
        />
      ) : (
        <div
          className={cn("aspect-square w-full rounded bg-background")}
          role="img"
          aria-label={product.name}
        />
      )}
      {categoryName ? <p className="mt-3 text-sm text-muted">{categoryName}</p> : null}
      <h3 className="font-heading text-lg tracking-heading text-text">{product.name}</h3>
      <p className="mt-1 font-semibold text-text">{formatPrice(product.basePriceCents, locale)}</p>
    </a>
  );
}
