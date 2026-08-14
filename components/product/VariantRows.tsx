"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { ProductVariantDto } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

const quantityIcons = {
  small: "/icons/quantity/bowl-nuts.png",
  medium: "/icons/quantity/bag-nuts.png",
  large: "/icons/quantity/wheelbarrow-nuts.png",
} as const;

function getIcon(index: number, total: number) {
  if (index === 0) return quantityIcons.small;
  if (index === total - 1) return quantityIcons.large;
  return quantityIcons.medium;
}

export function VariantRows({
  variants,
  selectedId,
  onSelect,
  locale,
  inStockLabel,
  outOfStockLabel,
  ariaLabel,
}: {
  variants: ProductVariantDto[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  locale: Locale;
  inStockLabel: string;
  outOfStockLabel: string;
  ariaLabel: string;
}) {
  const sortedVariants = [...variants].sort(
    (left, right) => left.weightGrams - right.weightGrams
  );

  function handleArrowKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const radioGroup = event.currentTarget.closest('[role="radiogroup"]');
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + sortedVariants.length) % sortedVariants.length;
    const nextVariant = sortedVariants[nextIndex];
    onSelect(nextVariant.id);
    window.requestAnimationFrame(() => {
      radioGroup
        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
        [nextIndex]?.focus();
    });
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="space-y-3">
      {sortedVariants.map((variant, index) => {
        const isSelected = variant.id === selectedId;
        const isAvailable = variant.stock > 0;
        const pricePerKilo =
          variant.weightGrams > 0
            ? Math.round((variant.priceCents * 1000) / variant.weightGrams)
            : null;

        return (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(variant.id)}
            onKeyDown={(event) => handleArrowKey(event, index)}
            className={cn(
              "grid min-h-[92px] w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border bg-white px-3 py-3 text-left transition-[border-color,box-shadow,background-color] duration-200 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:px-4",
              isSelected
                ? "border-[#C9A227] bg-[#FFFDF6] shadow-[0_0_0_2px_rgba(224,178,0,0.16)]"
                : "border-[#D7D7D7] hover:border-[#C9A227]"
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
              <Image
                src={getIcon(index, sortedVariants.length)}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </span>

            <span className="min-w-0">
              <span className="block font-heading text-[1.05rem] font-bold leading-tight text-black sm:text-lg">
                {variant.label ?? `${variant.weightGrams} g`}
              </span>
              <span
                className={cn(
                  "mt-1.5 flex items-center gap-2 text-xs font-semibold sm:text-sm",
                  isAvailable ? "text-[#69B53D]" : "text-red-600"
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                {isAvailable ? inStockLabel : outOfStockLabel}
              </span>
            </span>

            <span className="shrink-0 text-right">
              <span className="block font-heading text-xl font-bold leading-none text-black">
                {formatPrice(variant.priceCents, locale)}
              </span>
              {pricePerKilo ? (
                <span className="mt-2 block text-xs text-[#9A948B] sm:text-sm">
                  {formatPrice(pricePerKilo, locale)}/kg
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
