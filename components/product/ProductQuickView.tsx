"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { product as productPath } from "@/lib/routes";
import { addCartItem } from "@/lib/storefront-state";
import { cn } from "@/lib/cn";
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
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const selected = product.variants.find((variant) => variant.id === selectedId) ?? product.variants[0];

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setSelectedId(product.variants[0]?.id);
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
  }, [onClose, open, product.variants]);

  if (!open || typeof document === "undefined") return null;

  function addSelectedToCart() {
    if (!selected) return;
    addCartItem(
      {
        variantId: selected.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantLabel: selected.label ?? `${selected.weightGrams} gram`,
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
        className="absolute inset-0 cursor-default bg-contrast/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={dictionary.product.closeQuickView}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`quick-view-${product.id}`}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-panel border border-border bg-surface shadow-card-hover sm:max-w-2xl sm:rounded-panel"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6">
          <h2 id={`quick-view-${product.id}`} className="text-heading-md">
            {dictionary.product.quickViewTitle}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={dictionary.product.closeQuickView}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text hover:bg-surface"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-background sm:h-24 sm:w-24">
              {primaryImage ? (
                <img
                  src={primaryImage.url}
                  alt={primaryImage.alt ?? product.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <h3 className="text-heading-sm leading-tight sm:text-heading-md">{product.name}</h3>
              <p className="mt-1 font-semibold text-text">
                {formatPrice(product.basePriceCents, locale)}
              </p>
            </div>
          </div>

          {product.description ? (
            <p className="mt-4 line-clamp-3 text-body-sm leading-relaxed text-muted">
              {product.description}
            </p>
          ) : null}

          {product.variants.length > 0 ? (
            <div className="mt-5" role="radiogroup" aria-label={dictionary.product.quickViewTitle}>
              <div className="space-y-3">
                {product.variants.map((variant) => {
                  const isSelected = variant.id === selected?.id;
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
                      onClick={() => {
                        setSelectedId(variant.id);
                        setAdded(false);
                      }}
                      onKeyDown={(event) => {
                        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
                          return;
                        }
                        event.preventDefault();
                        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
                        const nextIndex =
                          (product.variants.findIndex((item) => item.id === variant.id) +
                            direction +
                            product.variants.length) %
                          product.variants.length;
                        setSelectedId(product.variants[nextIndex].id);
                        setAdded(false);
                        dialogRef.current
                          ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                          [nextIndex]?.focus();
                      }}
                      className={cn(
                        "flex min-h-20 w-full items-center gap-3 rounded-card border bg-surface p-3 text-left transition-colors duration-hover-fast",
                        isSelected
                          ? "border-accent ring-2 ring-accent/25"
                          : "border-border hover:border-border-hover"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          isSelected
                            ? "border-accent bg-accent text-contrast"
                            : "border-border text-transparent"
                        )}
                        aria-hidden="true"
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-base font-semibold leading-tight text-text">
                          {variant.label ?? `${variant.weightGrams} gram`}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {variant.weightGrams} g
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-heading text-lg font-semibold text-text">
                          {formatPrice(variant.priceCents, locale)}
                        </span>
                        {pricePerKilo ? (
                          <span className="block text-xs text-muted">
                            {formatPrice(pricePerKilo, locale)}/kg
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border bg-surface px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 shrink-0 items-center rounded-button border border-border bg-surface">
              <button
                type="button"
                aria-label={dictionary.cart.decrease}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="inline-flex h-12 w-11 items-center justify-center"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-8 text-center font-semibold" aria-label={dictionary.product.quantity}>
                {quantity}
              </span>
              <button
                type="button"
                aria-label={dictionary.cart.increase}
                onClick={() => setQuantity((value) => value + 1)}
                className="inline-flex h-12 w-11 items-center justify-center"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              disabled={!selected}
              onClick={addSelectedToCart}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-accent bg-accent px-4 font-heading font-semibold text-contrast shadow-button transition-colors hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {added ? <Check className="h-5 w-5" aria-hidden="true" /> : <ShoppingCart className="h-5 w-5" aria-hidden="true" />}
              <span className="truncate" aria-live="polite">
                {added ? (
                  <>
                    <span className="min-[360px]:hidden">{dictionary.product.added}</span>
                    <span className="hidden min-[360px]:inline">
                      {dictionary.product.addedToCart}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="min-[360px]:hidden">{dictionary.product.order}</span>
                    <span className="hidden min-[360px]:inline">{dictionary.product.addToCart}</span>
                  </>
                )}
              </span>
            </button>
          </div>
          <Link
            href={productPath(locale, product.slug)}
            onClick={onClose}
            className="mt-3 block min-h-11 py-3 text-center font-heading text-sm font-semibold text-text underline decoration-border-hover underline-offset-4 hover:text-accent-hover"
          >
            {dictionary.product.fullDetails}
          </Link>
        </footer>
      </div>
    </div>,
    document.body
  );
}
