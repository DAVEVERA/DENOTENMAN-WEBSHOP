import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { BASE_URL } from "@/lib/routes";
import type { CategoryTileData } from "@/lib/category-tiles-core";
import { CategoryTile } from "@/components/category/CategoryTile";

export type CategoryTileGridProps = {
  eyebrow: string;
  title: string;
  viewAllLabel: string;
  viewAllHref: string;
  tiles: CategoryTileData[];
  /** Id of the section heading, for aria-labelledby. */
  sectionId: string;
};

const SIZES = "(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 17vw";

/** The subcategory tiles of a main category, in the look of "Ons assortiment" on the landing. */
export function CategoryTileGrid({ eyebrow, title, viewAllLabel, viewAllHref, tiles, sectionId }: CategoryTileGridProps) {
  if (tiles.length === 0) return null;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: tiles.length,
    itemListElement: tiles.map((tile, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tile.name,
      url: `${BASE_URL}${tile.href}`,
    })),
  };

  return (
    <section className="bg-[linear-gradient(180deg,#f1e9de_0%,#faf8f4_11rem,#faf8f4_100%)]" aria-labelledby={sectionId}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\u003c") }} />
      <div className="mx-auto w-full max-w-[88rem] px-4 py-14 sm:px-6 sm:py-16 lg:px-10 lg:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">{eyebrow}</p>
            <h2 id={sectionId} className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">
              {title}
            </h2>
          </div>
          <Link
            href={viewAllHref}
            prefetch={false}
            className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 py-2 font-heading text-sm font-bold text-contrast underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
          >
            {viewAllLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul
          className={cn(
            "mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3",
            // Six or fewer fill one landing-style row; more wrap into rows of five.
            tiles.length <= 6 ? "lg:grid-cols-6" : "lg:grid-cols-5",
          )}
        >
          {tiles.map((tile) => (
            <li key={tile.key} className="min-w-0">
              <CategoryTile href={tile.href} name={tile.name} imageSrc={tile.imageSrc ?? undefined} alt={tile.name} nameAs="h3" sizes={SIZES} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
