"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { ProductVariantDto } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export function VariantSelector({
  variants,
  locale,
  outOfStockLabel,
  addToCartLabel,
}: {
  variants: ProductVariantDto[];
  locale: Locale;
  outOfStockLabel: string;
  addToCartLabel: string;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  if (!selected) {
    return null;
  }

  const outOfStock = selected.stock === 0;

  return (
    <div>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = variant.id === selected.id;
          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedId(variant.id)}
              className={cn(
                "rounded-button border px-4 py-2 text-body-sm transition-colors duration-hover-fast",
                isSelected
                  ? "border-accent bg-accent text-contrast"
                  : "border-border bg-surface text-text hover:border-border-hover"
              )}
            >
              {variant.label ?? variant.sku}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <p className="text-heading-sm font-semibold text-text">
          {formatPrice(selected.priceCents, locale)}
        </p>
        {outOfStock ? (
          <p className="mt-1 text-body-sm text-red-600">{outOfStockLabel}</p>
        ) : null}
      </div>
      <Button type="button" disabled={outOfStock} className="mt-6">
        {addToCartLabel}
      </Button>
    </div>
  );
}
