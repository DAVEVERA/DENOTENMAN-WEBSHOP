"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ProductVariantDto } from "@/lib/queries";
import { addCartItem } from "@/lib/storefront-state";
import { productActionButtonClass } from "@/lib/product-action-button";
import { VariantRows } from "@/components/product/VariantRows";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export function VariantSelector({
  variants,
  locale,
  unit,
  isActive,
  product,
}: {
  variants: ProductVariantDto[];
  locale: Locale;
  unit: "WEIGHT" | "VOLUME";
  isActive: boolean;
  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
  };
}) {
  const dictionary = dictionaries[locale];
  const firstVariant = [...variants].sort(
    (left, right) => left.weightGrams - right.weightGrams
  )[0];
  const [selectedId, setSelectedId] = useState(firstVariant?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const selected = variants.find((variant) => variant.id === selectedId) ?? firstVariant;

  if (!selected) {
    return null;
  }

  function selectVariant(id: string) {
    setSelectedId(id);
    setAdded(false);
  }

  function addSelectedToCart() {
    if (!isActive || selected.stock <= 0) return;
    addCartItem(
      {
        variantId: selected.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantLabel: selected.label ?? `${selected.weightGrams} ${unit === "VOLUME" ? "ml" : "g"}`,
        priceCents: selected.priceCents,
        imageUrl: product.imageUrl,
        locale,
      },
      quantity
    );
    setAdded(true);
  }

  return (
    <div>
      <VariantRows
        variants={variants}
        selectedId={selected.id}
        onSelect={selectVariant}
        locale={locale}
        unit={unit}
        inStockLabel={dictionary.product.inStock}
        outOfStockLabel={dictionary.product.outOfStock}
        ariaLabel={dictionary.product.selectQuantity}
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="grid h-12 shrink-0 grid-cols-3 overflow-hidden rounded border border-[#A8A8A8] bg-white sm:w-[132px]">
          <button
            type="button"
            aria-label={dictionary.cart.decrease}
            onClick={() => {
              setQuantity((value) => Math.max(1, value - 1));
              setAdded(false);
            }}
            className="inline-flex min-h-11 items-center justify-center border-r border-[#A8A8A8] hover:bg-[#F6F3EE]"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            className="inline-flex min-h-11 items-center justify-center font-semibold text-black"
            aria-label={dictionary.product.quantity}
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label={dictionary.cart.increase}
            onClick={() => {
              setQuantity((value) => value + 1);
              setAdded(false);
            }}
            className="inline-flex min-h-11 items-center justify-center border-l border-[#A8A8A8] hover:bg-[#F6F3EE]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          disabled={!isActive || selected.stock <= 0}
          onClick={addSelectedToCart}
          className={`${productActionButtonClass} h-12 flex-1`}
        >
          {added ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          )}
          <span aria-live="polite">
            {added
              ? dictionary.product.addedToCart
              : isActive
                ? dictionary.product.order
                : dictionary.product.outOfStock}
          </span>
        </button>
      </div>
    </div>
  );
}
