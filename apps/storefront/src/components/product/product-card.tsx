import Link from "next/link";
import { formatPrice, formatPricePer100g } from "@/lib/format";
import { Leaf, Award, Package } from "lucide-react";

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
  category,
}: ProductCardProps) {
  const cheapest = variants.reduce(
    (min, v) => (v.priceCents < min.priceCents ? v : min),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    variants[0]!,
  );

  const inStock = variants.some((v) => v.stockQuantity > 0);
  const image = images[0];

  return (
    <Link
      href={`/product/${slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {image ? (
          <img
            src={image.url}
            alt={image.altText}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            <Package className="h-12 w-12" />
          </div>
        )}
        {organic && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            <Leaf className="h-3 w-3" />
            Biologisch
          </span>
        )}
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900">
              Uitverkocht
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {category.name}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-neutral-900 line-clamp-2 group-hover:text-brand-green-700 transition-colors">
          {name}
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">{cheapest.name}</p>

        {/* Price */}
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-neutral-900">
              {formatPrice(cheapest.priceCents)}
            </span>
            <span className="text-[11px] text-neutral-500">
              {formatPricePer100g(cheapest.priceCents, cheapest.weightGrams)} / 100g
            </span>
          </div>
        </div>

        {/* Taste notes */}
        {tasteNotes && (
          <p className="mt-1.5 text-[11px] italic text-neutral-500 line-clamp-1">{tasteNotes}</p>
        )}

        {/* Trust badges */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-green-50 px-2 py-0.5 text-[10px] font-medium text-brand-green-700">
            <Award className="h-3 w-3" />
            Vers verpakt
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-earth-50 px-2 py-0.5 text-[10px] font-medium text-brand-earth-600">
            Transparante herkomst
          </span>
        </div>
      </div>
    </Link>
  );
}
