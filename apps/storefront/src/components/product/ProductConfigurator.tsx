"use client";

import { useState } from "react";
import { formatPrice, formatPricePer100g } from "@/lib/format";
import { ShoppingBag, Heart, Minus, Plus, PackageOpen, Box, Archive, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  name: string;
  priceCents: number;
  weightGrams: number;
  stockQuantity: number;
}

interface Props {
  variants: Variant[];
}

function getIconForVariant(name: string) {
  const n = name.toLowerCase();
  if (n.includes("emmer")) {
    return <Archive className="w-5 h-5 text-neutral-400" />;
  }
  if (n.includes("doos")) {
    return <Box className="w-5 h-5 text-neutral-400" />;
  }
  if (n.includes("zak")) {
    return <PackageOpen className="w-5 h-5 text-neutral-400" />;
  }
  return <Scale className="w-5 h-5 text-neutral-400" />;
}

export function ProductConfigurator({ variants }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);

  if (variants.length === 0) {
    return <p className="text-danger">Dit product is momenteel niet leverbaar.</p>;
  }

  const handleDecrease = () => {
    setQuantity((q) => Math.max(1, q - 1));
  };
  const handleIncrease = () => {
    setQuantity((q) => q + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        {variants.map((variant) => {
          const isSelected = selectedVariantId === variant.id;
          const isOutOfStock = variant.stockQuantity <= 0;

          return (
            <button
              key={variant.id}
              disabled={isOutOfStock}
              onClick={() => {
                setSelectedVariantId(variant.id);
              }}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-brand-green bg-brand-green-50/50"
                  : "border-neutral-200 bg-white hover:border-brand-green-200",
                isOutOfStock && "opacity-50 cursor-not-allowed grayscale",
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg",
                    isSelected ? "bg-white shadow-sm" : "bg-neutral-50",
                  )}
                >
                  {getIconForVariant(variant.name)}
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">{variant.name}</p>
                  {variant.weightGrams > 0 && (
                    <p className="text-xs text-neutral-500">
                      {formatPricePer100g(variant.priceCents, variant.weightGrams)} / 100g
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-neutral-900">
                  {formatPrice(variant.priceCents)}
                </p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  {isOutOfStock ? (
                    <span className="text-xs font-medium text-danger">Uitverkocht</span>
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                      <span className="text-xs font-medium text-brand-green-700">Op voorraad</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center justify-between border-2 border-neutral-200 bg-white rounded-xl h-14 w-full sm:w-32 px-2 shrink-0">
          <button
            onClick={handleDecrease}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
            aria-label="Verlaag aantal"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="font-bold text-neutral-900 w-8 text-center">{quantity}</span>
          <button
            onClick={handleIncrease}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
            aria-label="Verhoog aantal"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button className="flex-1 w-full bg-brand-green text-white h-14 rounded-xl font-bold shadow-sm shadow-brand-green/20 hover:bg-brand-green-600 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 group">
          <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Bestellen
        </button>

        <button
          className="w-full sm:w-14 h-14 flex items-center justify-center border-2 border-neutral-200 rounded-xl hover:border-danger hover:text-danger hover:bg-danger-light transition-colors text-neutral-500 shrink-0"
          aria-label="Bewaren"
          title="Toevoegen aan verlanglijst"
        >
          <Heart className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
