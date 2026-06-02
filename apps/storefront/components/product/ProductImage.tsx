"use client";

import { useState } from "react";

type ProductImageProps = {
  alt: string;
  className?: string;
  fallbackSrc?: string | null;
  src: string | null;
};

export function ProductImage({ alt, className, fallbackSrc = null, src }: ProductImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  if (!currentSrc) {
    return null;
  }

  return (
    <img
      alt={alt}
      className={className}
      src={currentSrc}
      onError={() => setCurrentSrc(currentSrc === fallbackSrc ? null : fallbackSrc)}
    />
  );
}
