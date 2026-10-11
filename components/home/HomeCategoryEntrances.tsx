import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CategoryTile } from "@/components/category/CategoryTile";

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
          <div className="flex min-h-11 flex-col items-start justify-between gap-1 px-3 py-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3 min-[380px]:py-0 sm:px-4">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-accent-ink">
              {eyebrow}
            </p>
            <Link
              href={viewAllHref}
              prefetch={false}
              className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 py-2 text-left font-heading text-sm font-bold leading-5 text-contrast underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast min-[380px]:min-h-12 min-[380px]:shrink-0 min-[380px]:text-base"
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
                <CategoryTile href={category.href} name={category.name} imageSrc={category.imageSrc} />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
