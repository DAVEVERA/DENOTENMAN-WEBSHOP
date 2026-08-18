import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

const startingPriceLabel = {
  nl: { short: "v.a.", full: "Vanaf" },
  en: { short: "From", full: "From" },
  fr: { short: "Dès", full: "Dès" },
} satisfies Record<Locale, { short: string; full: string }>;

export function ProductPrice({
  product,
  locale,
}: {
  product: Pick<
    ProductSummaryDto,
    "basePriceCents" | "regularBasePriceCents" | "salePriceCents" | "hasVariablePrice"
  >;
  locale: Locale;
}) {
  const formattedPrice = formatPrice(product.basePriceCents, locale);
  const label = startingPriceLabel[locale];

  return (
    <p className="min-w-0">
      {product.salePriceCents !== null ? (
        <span className="block text-xs text-muted line-through">
          {formatPrice(product.regularBasePriceCents, locale)}
        </span>
      ) : null}
      <span
        className={cn(
          "text-sm font-semibold text-text sm:text-base",
          product.salePriceCents !== null && "text-red-700"
        )}
      >
        {product.hasVariablePrice ? (
          <>
            <span className="sr-only">{label.full} {formattedPrice}</span>
            <span aria-hidden="true">{label.short} {formattedPrice}</span>
          </>
        ) : (
          formattedPrice
        )}
      </span>
    </p>
  );
}
