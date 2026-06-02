"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/format";

interface ProductVariant {
  id: string;
  name: string;
  weightGrams: number;
  priceCents: number;
  stockQuantity: number;
}

interface ProductImage {
  url: string;
  altText: string;
}

export interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  tasteNotes: string | null;
  organic: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
  category: { name: string };
}

export function ProductCard({
  slug,
  name,
  tasteNotes,
  organic,
  variants,
  images,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const image = images[0];
  if (!image || imgBroken) {
    return null;
  }

  const cheapest = variants.reduce<ProductVariant | undefined>((min, v) => {
    if (!min) {
      return v;
    }
    return v.priceCents < min.priceCents ? v : min;
  }, undefined);

  if (!cheapest) {
    return null;
  }

  return (
    <div
      className="product-card group"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      {/* Bowl image container */}
      <div className="product-card__bowl">
        {/* Vignette for depth illusion */}
        <div className="product-card__vignette" />

        {/* Product image — top-down photography */}
        <img
          src={image.url}
          alt={image.altText || name}
          className="product-card__img"
          loading="lazy"
          onError={() => {
            setImgBroken(true);
          }}
        />

        {/* Inner shadow rim — simulates bowl edge */}
        <div className="product-card__rim" />

        {/* Organic badge */}
        {organic && <span className="product-card__badge">BIO</span>}

        {/* CTA overlay on hover */}
        <div className={`product-card__overlay${hovered ? " product-card__overlay--visible" : ""}`}>
          <button
            className="product-card__cta product-card__cta--primary"
            onClick={(e) => {
              e.preventDefault();
              // TODO: add-to-cart
            }}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Snel bestellen
          </button>
          <Link
            href={`/product/${slug}`}
            className="product-card__cta product-card__cta--secondary"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Product details
          </Link>
        </div>
      </div>

      {/* Info beneath */}
      <Link href={`/product/${slug}`} className="product-card__info">
        <p className="product-card__name">{name}</p>
        {tasteNotes && <p className="product-card__notes">{tasteNotes}</p>}
        <p className="product-card__price">v.a. {formatPrice(cheapest.priceCents)}</p>
      </Link>
    </div>
  );
}
