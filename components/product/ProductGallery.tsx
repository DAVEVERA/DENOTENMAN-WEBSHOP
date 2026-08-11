"use client";

import { useState } from "react";
import type { ProductImageDto } from "@/lib/queries";
import { cn } from "@/lib/cn";

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImageDto[];
  productName: string;
}) {
  const primaryIndex = images.findIndex((image) => image.isPrimary);
  const [selectedIndex, setSelectedIndex] = useState(primaryIndex >= 0 ? primaryIndex : 0);

  const selected = images[selectedIndex];

  if (!selected) {
    return (
      <div
        className={cn("aspect-square w-full rounded bg-background")}
        role="img"
        aria-label={productName}
      />
    );
  }

  return (
    <div>
      <img
        src={selected.url}
        alt={selected.alt ?? productName}
        className="aspect-square w-full rounded-card object-cover"
      />
      {images.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              aria-label={image.alt ?? productName}
              aria-current={index === selectedIndex}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded border transition-colors duration-hover-fast",
                index === selectedIndex
                  ? "border-accent"
                  : "border-border hover:border-border-hover"
              )}
            >
              <img
                src={image.url}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
