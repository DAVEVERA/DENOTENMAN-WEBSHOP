import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getProductImageStyle } from "@/lib/image-focal";

export type CategoryTileProps = {
  href: string;
  name: string;
  imageSrc?: string;
  /** The landing keeps decorative images (the name sits next to them); category pages pass the name. */
  alt?: string;
  /** Heading level of the name: a plain span on the landing, an h3 under a section h2 elsewhere. */
  nameAs?: "span" | "h3";
  sizes?: string;
};

const DEFAULT_SIZES = "(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 15vw";

/** One clickable photo tile: the whole card is a single link with photo, name and arrow. */
export function CategoryTile({ href, name, imageSrc, alt = "", nameAs = "span", sizes = DEFAULT_SIZES }: CategoryTileProps) {
  const Name = nameAs;
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex min-h-11 touch-manipulation flex-col overflow-hidden rounded-[0.85rem] border border-border bg-[#f7f4ee] shadow-[0_4px_14px_rgba(47,36,22,0.08)] transition-[border-color,box-shadow,transform] duration-hover hover:-translate-y-1 hover:border-border-hover hover:shadow-[0_10px_24px_rgba(47,36,22,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
    >
      <span className="relative block aspect-[4/5] overflow-hidden">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={alt}
            fill
            sizes={sizes}
            style={getProductImageStyle(imageSrc)}
            className="product-image-focal absolute inset-0 h-full w-full object-cover transition-transform duration-hover group-hover:scale-[1.06]"
          />
        ) : nameAs === "h3" ? (
          <span className="absolute inset-0 bg-[#efe6d8]" aria-hidden="true" />
        ) : null}
      </span>
      <span className="flex items-center justify-between gap-2 px-1 pb-2 pt-2 sm:pt-2.5">
        <Name className="min-w-0 truncate font-heading text-sm font-bold leading-tight text-text sm:text-base">{name}</Name>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-text transition-transform duration-hover group-hover:translate-x-0.5"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
