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
      className="relative z-20 -mt-[5.25rem] pb-4 sm:-mt-[5.5rem] lg:-mt-[5.25rem]"
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

          <ul className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3 sm:px-4 lg:grid-cols-6">
            {categories.map((category) => (
              <li
                key={category.id}
                className="min-w-0"
              >
                <Link
                  href={category.href}
                  prefetch={false}
                  className="group flex min-h-14 touch-manipulation items-center justify-between gap-2 rounded-[0.55rem] border border-border bg-[#f7f4ee] px-3 py-2.5 transition-[border-color,background-color,transform] duration-hover hover:-translate-y-0.5 hover:border-border-hover hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
                >
                  <span className="min-w-0 font-heading text-sm font-bold leading-tight text-contrast">
                    {category.name}
                  </span>
                  {category.imageSrc ? (
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-full border border-[#ded5c7] bg-white shadow-[0_4px_12px_rgba(47,36,22,0.12)]">
                      <Image
                        src={category.imageSrc}
                        alt=""
                        fill
                        sizes="40px"
                        style={getProductImageStyle(category.imageSrc)}
                        className="product-image-focal h-full w-full object-cover transition-transform duration-hover group-hover:scale-[1.04]"
                      />
                      <span className="absolute bottom-0 right-0 inline-flex size-4 items-center justify-center rounded-full bg-accent text-contrast shadow-sm">
                        <ArrowRight
                          className="h-2.5 w-2.5"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  ) : (
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-hover group-hover:translate-x-0.5 group-hover:text-accent-ink"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
