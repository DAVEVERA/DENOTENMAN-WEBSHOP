"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Minus,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

const FREE_SHIPPING_THRESHOLD_CENTS = 4000;
const SHIPPING_COSTS_CENTS = 495;

export default function WinkelwagenPage() {
  const { items, loading, itemCount, subtotalCents, updateQuantity, removeItem } = useCart();

  const shippingCents =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS || subtotalCents === 0
      ? 0
      : SHIPPING_COSTS_CENTS;
  const totalCents = subtotalCents + shippingCents;
  const remainingForFreeShipping = FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents;

  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight text-brand-primary sm:text-4xl mb-8 flex items-center gap-3">
          <ShoppingBag className="h-8 w-8 text-brand-gold" />
          Jouw Winkelwagen
          {itemCount > 0 && (
            <span className="text-base font-medium text-brand-primary/60">
              ({itemCount} artikel{itemCount !== 1 ? "en" : ""})
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-brand-gold/20 shadow-sm text-center max-w-lg mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/5 mb-6">
              <ShoppingBag className="h-10 w-10 text-brand-gold" />
            </div>
            <h2 className="text-2xl font-bold text-brand-primary mb-3">Je winkelwagen is leeg</h2>
            <p className="text-brand-primary/70 mb-8 max-w-md mx-auto">
              Het lijkt erop dat je nog geen van onze heerlijke verse noten of zuidvruchten hebt
              toegevoegd.
            </p>
            <Link
              href="/categorie/noten"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-8 py-4 text-base font-bold text-brand-gold hover:bg-brand-primary/90 hover:scale-105 transition-all shadow-lg"
            >
              Bekijk assortiment <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Cart Items List */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {subtotalCents < FREE_SHIPPING_THRESHOLD_CENTS && (
                <div className="flex items-center gap-3 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl px-5 py-3 text-sm text-brand-primary">
                  <Truck className="h-4 w-4 text-brand-gold shrink-0" />
                  <span>
                    Nog <strong>{formatPrice(remainingForFreeShipping)}</strong> tot gratis
                    verzending!
                  </span>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-brand-gold/20 shadow-sm overflow-hidden">
                <ul className="divide-y divide-neutral-100">
                  {items.map((item) => (
                    <li
                      key={item.lineId}
                      className="flex items-start sm:items-center gap-4 p-5 sm:p-6"
                    >
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-surface border border-neutral-100 shrink-0">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <ShoppingBag className="h-6 w-6 text-brand-gold/50" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-brand-primary leading-tight truncate">
                          {item.productName}
                        </p>
                        <p className="text-sm text-brand-primary/60 mt-0.5">{item.variantName}</p>
                        <p className="text-sm font-semibold text-brand-primary mt-1">
                          {formatPrice(item.priceCents)} per stuk
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                        <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden h-9">
                          <button
                            onClick={() => {
                              void updateQuantity(item.lineId, Math.max(1, item.quantity - 1));
                            }}
                            disabled={loading || item.quantity <= 1}
                            className="w-9 h-9 flex items-center justify-center hover:bg-neutral-100 text-neutral-600 transition-colors disabled:opacity-40"
                            aria-label="Verlaag aantal"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-neutral-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              void updateQuantity(item.lineId, item.quantity + 1);
                            }}
                            disabled={loading}
                            className="w-9 h-9 flex items-center justify-center hover:bg-neutral-100 text-neutral-600 transition-colors disabled:opacity-40"
                            aria-label="Verhoog aantal"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="text-base font-bold text-brand-primary w-20 text-right">
                          {formatPrice(item.priceCents * item.quantity)}
                        </p>

                        <button
                          onClick={() => {
                            void removeItem(item.lineId);
                          }}
                          disabled={loading}
                          className="p-2 rounded-lg text-neutral-400 hover:text-danger hover:bg-danger-light transition-colors disabled:opacity-40"
                          aria-label={`${item.productName} verwijderen`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Link
                  href="/categorie/noten"
                  className="text-sm font-medium text-brand-primary/70 hover:text-brand-primary transition-colors flex items-center gap-1.5"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Verder winkelen
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-4">
              <div className="bg-brand-primary text-white rounded-3xl p-8 sticky top-24 border border-brand-gold/30 shadow-xl overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `url('/Branding/Lookenfeel.png')`,
                    backgroundSize: "cover",
                  }}
                />
                <h2 className="text-xl font-bold text-brand-gold mb-6 relative z-10 border-b border-brand-gold/20 pb-4">
                  Besteloverzicht
                </h2>

                <div className="space-y-4 text-surface/90 relative z-10 mb-8 font-medium">
                  <div className="flex justify-between">
                    <span>Subtotaal</span>
                    <span>{formatPrice(subtotalCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verzending</span>
                    {shippingCents === 0 && subtotalCents > 0 ? (
                      <span className="text-brand-highlight font-bold">Gratis</span>
                    ) : subtotalCents === 0 ? (
                      <span className="text-surface/60 text-sm">Berekend bij afrekenen</span>
                    ) : (
                      <span>{formatPrice(shippingCents)}</span>
                    )}
                  </div>
                  <div className="border-t border-brand-gold/20 pt-4 mt-4 flex justify-between items-center">
                    <span className="text-lg font-bold text-brand-gold">Totaal (incl. BTW)</span>
                    <span className="text-2xl font-bold text-brand-highlight">
                      {formatPrice(totalCents)}
                    </span>
                  </div>
                </div>

                <Link
                  href="/afrekenen"
                  className="w-full bg-brand-gold text-brand-primary font-bold rounded-xl py-4 flex justify-center items-center gap-2 relative z-10 hover:bg-brand-gold/90 transition-colors shadow-lg"
                >
                  Afrekenen <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="mt-8 space-y-3 relative z-10">
                  <div className="flex items-center gap-3 text-sm text-surface/70">
                    <ShieldCheck className="h-5 w-5 text-brand-highlight shrink-0" />
                    <span>Veilig en versleuteld afrekenen</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-surface/70">
                    <CreditCard className="h-5 w-5 text-brand-highlight shrink-0" />
                    <span>iDEAL, Bancontact, Creditcard</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
