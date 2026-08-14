"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { addCartItem } from "@/lib/storefront-state";
import { getProductImageStyle } from "@/lib/image-focal";
import { productActionButtonClass } from "@/lib/product-action-button";
import { VariantRows } from "@/components/product/VariantRows";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };
const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ProductQuickView({
  open,
  onClose,
  product,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductSummaryDto;
  locale: Locale;
}) {
  const dictionary = dictionaries[locale];
  const firstVariant = [...product.variants].sort(
    (left, right) => left.weightGrams - right.weightGrams
  )[0];
  const [selectedId, setSelectedId] = useState(firstVariant?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const selected =
    product.variants.find((variant) => variant.id === selectedId) ?? firstVariant;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setSelectedId(firstVariant?.id);
    setQuantity(1);
    setAdded(false);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, [firstVariant?.id, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  function selectVariant(id: string) {
    setSelectedId(id);
    setAdded(false);
  }

  function addSelectedToCart() {
    if (!selected || selected.stock <= 0) return;
    addCartItem(
      {
        variantId: selected.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantLabel: selected.label ?? `${selected.weightGrams} g`,
        priceCents: selected.priceCents,
        imageUrl: primaryImage?.url ?? null,
        locale,
      },
      quantity
    );
    setAdded(true);
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={dictionary.product.closeQuickView}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`quick-view-${product.id}`}
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[12px] border border-[#D7D7D7] bg-white shadow-[0_18px_55px_rgba(0,0,0,0.25)] sm:max-w-xl sm:rounded-[12px]"
      >
        <header className="flex shrink-0 items-center justify-between bg-[#E8F5F7] px-4 py-4 sm:px-5">
          <h2 id={`quick-view-${product.id}`} className="font-heading text-lg font-bold text-black">
            {dictionary.product.selectQuantity}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={dictionary.product.closeQuickView}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#FF4646] transition-colors hover:bg-white/70"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-5">
          <div className="flex items-center gap-4">
            <div className="h-[74px] w-[74px] shrink-0 overflow-hidden rounded-full bg-[#DDEFF5]">
              {primaryImage ? (
                <img
                  src={primaryImage.url}
                  alt={primaryImage.alt ?? product.name}
                  style={getProductImageStyle(primaryImage.url)}
                  className="product-image-focal h-full w-full rounded-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-base font-bold leading-tight text-black sm:text-lg">
                {product.name}
              </h3>
              {product.shortDescription ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6E675C] sm:text-sm">
                  {product.shortDescription}
                </p>
              ) : null}
            </div>
          </div>

          {product.variants.length > 0 ? (
            <div className="mt-5">
              <VariantRows
                variants={product.variants}
                selectedId={selected?.id}
                onSelect={selectVariant}
                locale={locale}
                inStockLabel={dictionary.product.inStock}
                outOfStockLabel={dictionary.product.outOfStock}
                ariaLabel={dictionary.product.selectQuantity}
              />
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[#E4DFD5] bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          <div className="flex items-stretch gap-3">
            <div className="grid h-12 w-[114px] shrink-0 grid-cols-3 overflow-hidden rounded border border-[#A8A8A8] bg-white sm:w-[132px]">
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
              disabled={!selected || selected.stock <= 0}
              onClick={addSelectedToCart}
              className={`${productActionButtonClass} h-12 min-w-0 flex-1 px-3 sm:px-6`}
            >
              {added ? (
                <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate" aria-live="polite">
                {added ? (
                  dictionary.product.added
                ) : (
                  <>
                    <span className="min-[360px]:hidden">{dictionary.product.order}</span>
                    <span className="hidden min-[360px]:inline">
                      {dictionary.product.quickOrder}
                    </span>
                  </>
                )}
              </span>
            </button>
          </div>
          <Link
            href={productPath(locale, product.slug)}
            onClick={onClose}
            className={`${productActionButtonClass} mt-3 w-full`}
          >
            {dictionary.product.moreInfo}
          </Link>
        </footer>
      </div>
    </div>,
    document.body
  );
}
