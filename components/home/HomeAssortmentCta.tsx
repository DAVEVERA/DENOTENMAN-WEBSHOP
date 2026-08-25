import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

export type HomeAssortmentCtaProps = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HomeAssortmentCta({ title, body, ctaLabel, ctaHref }: HomeAssortmentCtaProps) {
  return (
    <section className="bg-[linear-gradient(180deg,#f6f3ee_0%,#121212_5rem,#121212_100%)] pb-9 pt-20 text-surface sm:pb-11 sm:pt-24" aria-labelledby="home-assortment-title">
      <Container fullWidth className="flex flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-6 lg:px-10 xl:px-14 2xl:px-16">
        <div className="max-w-2xl">
          <h2 id="home-assortment-title" className="text-[clamp(1.625rem,7vw,2.5rem)] leading-tight text-surface">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-surface/75 sm:text-base">{body}</p>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex min-h-12 w-full shrink-0 touch-manipulation items-center justify-center gap-2 rounded-button bg-accent px-5 py-3 font-heading text-base font-bold text-contrast shadow-button transition-[background-color,transform] duration-hover-fast hover:bg-surface active:translate-y-px sm:w-auto"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}
