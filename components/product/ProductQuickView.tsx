"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type Ref } from "react";
import { ArrowLeft, Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { cart as cartPath, product as productPath } from "@/lib/routes";
import { addCartItem } from "@/lib/storefront-state";
import { getProductImageStyle } from "@/lib/image-focal";
import { BackInStockForm } from "@/components/product/BackInStockForm";
import { productActionButtonClass } from "@/lib/product-action-button";
import { VariantRows } from "@/components/product/VariantRows";
const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ProductQuickViewCopy = {
  selectQuantity: string;
  closeQuickView: string;
  outOfStock: string;
  inStock: string;
  quantity: string;
  added: string;
  goToCart: string;
  continueShopping: string;
  order: string;
  quickOrder: string;
  moreInfo: string;
  decrease: string;
  increase: string;
};

export function ProductQuickViewAddedActions({
  locale,
  productName,
  quantity,
  labels,
  onContinue,
  primaryActionRef,
}: {
  locale: Locale;
  productName: string;
  quantity: number;
  labels: { added: string; goToCart: string; continueShopping: string };
  onContinue: () => void;
  primaryActionRef?: Ref<HTMLAnchorElement>;
}) {
  return (
    <div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-start gap-3 rounded-[10px] border border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50 px-4 py-3 text-emerald-950"
      >
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-sm font-bold sm:text-base">{labels.added}</span>
          <span className="mt-0.5 block text-xs leading-snug text-emerald-900 sm:text-sm">
            {quantity}× {productName}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <Link
          ref={primaryActionRef}
          href={cartPath(locale)}
          onClick={onContinue}
          className={`${productActionButtonClass} min-h-12 touch-manipulation px-4 text-center`}
        >
          <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{labels.goToCart}</span>
        </Link>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded border-2 border-black bg-white px-4 font-heading font-semibold text-black transition-colors hover:bg-[#F6F3EE] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:bg-[#EDE7DE]"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{labels.continueShopping}</span>
        </button>
      </div>
    </div>
  );
}

const quickViewCopies: Record<Locale, ProductQuickViewCopy> = {
  nl: {
    selectQuantity: "Selecteer hoeveelheid",
    closeQuickView: "Sluit productinformatie",
    outOfStock: "Niet op voorraad",
    inStock: "Op voorraad",
    quantity: "Aantal",
    added: "Toegevoegd aan je winkelwagen",
    goToCart: "Naar winkelwagen",
    continueShopping: "Verder winkelen",
    order: "Bestellen",
    quickOrder: "Snel bestellen",
    moreInfo: "Meer info",
    decrease: "Verlaag aantal",
    increase: "Verhoog aantal",
  },
  en: {
    selectQuantity: "Select quantity",
    closeQuickView: "Close product information",
    outOfStock: "Out of stock",
    inStock: "In stock",
    quantity: "Quantity",
    added: "Added to your cart",
    goToCart: "Go to cart",
    continueShopping: "Continue shopping",
    order: "Order",
    quickOrder: "Quick order",
    moreInfo: "More info",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
  },
  fr: {
    selectQuantity: "S\u00e9lectionnez la quantit\u00e9",
    closeQuickView: "Fermer les informations produit",
    outOfStock: "Rupture de stock",
    inStock: "En stock",
    quantity: "Quantit\u00e9",
    added: "Ajout\u00e9 \u00e0 votre panier",
    goToCart: "Voir le panier",
    continueShopping: "Continuer mes achats",
    order: "Commander",
    quickOrder: "Commander rapidement",
    moreInfo: "Plus d\u2019infos",
    decrease: "Diminuer la quantit\u00e9",
    increase: "Augmenter la quantit\u00e9",
  },
};

export function ProductQuickView({
  open,
  onClose,
  product,
  locale,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductSummaryDto;
  locale: Locale;
  copy?: ProductQuickViewCopy;
}) {
  const labels = copy ?? quickViewCopies[locale];
  const firstVariant = [...product.variants].sort(
    (left, right) => left.weightGrams - right.weightGrams
  )[0];
  const [selectedId, setSelectedId] = useState(firstVariant?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cartActionRef = useRef<HTMLAnchorElement>(null);
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

  useEffect(() => {
    if (!added) return;
    const frame = window.requestAnimationFrame(() => cartActionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [added]);

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
        variantLabel: selected.label ?? `${selected.weightGrams} ${product.unit === "VOLUME" ? "ml" : "g"}`,
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
        aria-label={labels.closeQuickView}
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
            {labels.selectQuantity}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={labels.closeQuickView}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#FF4646] transition-colors hover:bg-white/70"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-5">
          <div className="flex items-center gap-4">
            <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-full bg-[#DDEFF5]">
              {primaryImage ? (
                <Image
                  src={primaryImage.url}
                  alt={primaryImage.alt ?? product.name}
                  fill
                  sizes="74px"
                  quality={70}
                  style={getProductImageStyle(primaryImage.url)}
                  className="product-image-focal h-full w-full rounded-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-base font-bold leading-tight text-black sm:text-lg">
                {product.name}
              </h3>
              {!product.isActive ? (
                <span className="mt-1 inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                  {labels.outOfStock}
                </span>
              ) : null}
              {product.shortDescription ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6E675C] sm:text-sm">
                  {product.shortDescription}
                </p>
              ) : null}
              {!product.isActive ? <BackInStockForm productId={product.id} locale={locale} /> : null}
            </div>
          </div>

          {product.variants.length > 0 ? (
            <div className="mt-5">
              <VariantRows
                variants={product.variants}
                selectedId={selected?.id}
                onSelect={selectVariant}
                locale={locale}
                unit={product.unit}
                inStockLabel={labels.inStock}
                outOfStockLabel={labels.outOfStock}
                ariaLabel={labels.selectQuantity}
              />
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[#E4DFD5] bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          {added ? (
            <ProductQuickViewAddedActions
              locale={locale}
              productName={product.name}
              quantity={quantity}
              labels={labels}
              onContinue={onClose}
              primaryActionRef={cartActionRef}
            />
          ) : (
            <>
              <div className="flex items-stretch gap-3">
                <div className="grid h-12 w-[114px] shrink-0 grid-cols-3 overflow-hidden rounded border border-[#A8A8A8] bg-white sm:w-[132px]">
                  <button
                    type="button"
                    aria-label={labels.decrease}
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="inline-flex min-h-11 items-center justify-center border-r border-[#A8A8A8] hover:bg-[#F6F3EE]"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    className="inline-flex min-h-11 items-center justify-center font-semibold text-black"
                    aria-label={labels.quantity}
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={labels.increase}
                    onClick={() => setQuantity((value) => value + 1)}
                    className="inline-flex min-h-11 items-center justify-center border-l border-[#A8A8A8] hover:bg-[#F6F3EE]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!product.isActive || !selected || selected.stock <= 0}
                  onClick={addSelectedToCart}
                  className={`${productActionButtonClass} h-12 min-w-0 flex-1 px-3 sm:px-6`}
                >
                  <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    <span className="min-[360px]:hidden">{labels.order}</span>
                    <span className="hidden min-[360px]:inline">{labels.quickOrder}</span>
                  </span>
                </button>
              </div>
              <Link
                href={productPath(locale, product.slug)}
                onClick={onClose}
                className={`${productActionButtonClass} mt-3 w-full`}
              >
                {labels.moreInfo}
              </Link>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
