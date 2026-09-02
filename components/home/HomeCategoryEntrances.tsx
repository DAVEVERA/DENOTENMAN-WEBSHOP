import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { getProductImageStyle } from "@/lib/image-focal";

export type HomeCategoryEntrance = {
  id: string;
  name: string;
  href: string;
  imageSrc?: string;
};

export type HomeCategoryEntrancesProps = {
  eyebrow: string;
  title: string;
  intro: string;
  viewAllLabel: string;
  viewAllHref: string;
  categories: HomeCategoryEntrance[];
};

export function HomeCategoryEntrances({
  eyebrow,
  title,
  intro,
  viewAllLabel,
  viewAllHref,
  categories,
}: HomeCategoryEntrancesProps) {
  if (!categories.length) return null;

  return (
    <section
      data-home-section="categories"
      className="relative z-20 -mt-[5.25rem] bg-transparent pb-4 sm:-mt-[5.5rem] lg:-mt-[5.25rem]"
      aria-labelledby="home-categories-title"
    >
      <Container fullWidth className="px-3 sm:px-5 lg:px-8 xl:px-12">
        <div className="overflow-hidden rounded-[0.75rem] border-x border-b border-border bg-white/[0.97] shadow-[0_18px_45px_rgba(35,27,18,0.12)] backdrop-blur-sm">
          <div className="flex min-h-11 items-center justify-between gap-3 px-3 sm:px-4">
            <p className="font-heading text-[0.7rem] font-bold uppercase tracking-[0.15em] text-accent-ink sm:text-xs">
              {eyebrow}
            </p>
            <Link
              href={viewAllHref}
              prefetch={false}
              className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 py-2 font-heading text-[0.72rem] font-bold text-contrast underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast sm:text-xs"
            >
              {viewAllLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <h2 id="home-categories-title" className="sr-only">
            {title}
          </h2>
          <p className="sr-only">{intro}</p>

          <ul className="grid grid-cols-2 gap-2.5 px-3 pb-3 sm:grid-cols-3 sm:gap-3 sm:px-4 lg:grid-cols-6">
            {categories.map((category) => (
              <li key={category.id} className="min-w-0">
                <Link
                  href={category.href}
                  prefetch={false}
                  className="group relative flex aspect-[4/5] touch-manipulation flex-col justify-end overflow-hidden rounded-[0.85rem] border border-border bg-[#f7f4ee] shadow-[0_4px_14px_rgba(47,36,22,0.08)] transition-[border-color,box-shadow,transform] duration-hover hover:-translate-y-1 hover:border-border-hover hover:shadow-[0_10px_24px_rgba(47,36,22,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
                >
                  {category.imageSrc ? (
                    <Image
                      src={category.imageSrc}
                      alt=""
                      fill
                      sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 15vw"
                      style={getProductImageStyle(category.imageSrc)}
                      className="product-image-focal absolute inset-0 h-full w-full object-cover transition-transform duration-hover group-hover:scale-[1.06]"
                    />
                  ) : null}
                  <span
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="relative z-10 flex items-end justify-between gap-2 p-2.5 sm:p-3">
                    <span className="min-w-0 font-heading text-sm font-bold leading-tight text-white drop-shadow-sm sm:text-base">
                      {category.name}
                    </span>
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-contrast shadow-[0_3px_10px_rgba(0,0,0,0.25)] transition-transform duration-hover group-hover:scale-110 sm:size-9">
                      <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
