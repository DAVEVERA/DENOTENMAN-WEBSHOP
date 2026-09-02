import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, type LucideIcon } from "lucide-react";

export type CategoryStoryVariety = {
  name: string;
  description: string;
};

export type CategoryStoryFaq = {
  question: string;
  answer: string;
};

export type CategoryStoryContent = {
  shortLabel: string;
  seo: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string; imageAlt?: string };
  varieties: {
    eyebrow: string;
    title: string;
    intro: string;
    items: CategoryStoryVariety[];
  };
  story: { eyebrow: string; title: string; body: string[]; points: string[] };
  faqs: CategoryStoryFaq[];
  cta: { eyebrow: string; title: string; body: string; primaryLabel: string };
};

export type CategoryStoryPageProps = {
  content: CategoryStoryContent;
  productsHref: string;
  assortmentHref: string;
  assortmentLabel: string;
  heroImage?: { src: string; alt: string; objectPosition?: string };
  heroIcon?: LucideIcon;
};

const primaryCta =
  "inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-button bg-accent px-6 py-3 font-heading text-base font-bold text-contrast shadow-button transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast";

export function CategoryStoryPage({
  content,
  productsHref,
  assortmentHref,
  assortmentLabel,
  heroImage,
  heroIcon: HeroIcon,
}: CategoryStoryPageProps) {
  const faqJsonLd =
    content.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: content.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null;

  return (
    <article className="overflow-hidden bg-[#f8f5ef] text-text">
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-[96rem] px-4 pt-6 sm:px-6 lg:px-10 xl:px-14">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link href={assortmentHref} className="hover:text-accent-ink hover:underline">
              {assortmentLabel}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="font-semibold text-text" aria-current="page">
            {content.shortLabel}
          </li>
        </ol>
      </nav>

      <section className="bg-[linear-gradient(180deg,#f8f5ef_0%,#efe6d8_88%,#f1e9de_100%)]">
        <div className="mx-auto grid w-full max-w-[96rem] items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)] lg:gap-14 lg:px-10 lg:py-20 xl:px-14">
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              {content.hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-[16ch] text-[clamp(2.25rem,8vw,4.75rem)] leading-[0.98] tracking-heading text-contrast">
              {content.hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-text sm:text-xl sm:leading-9">
              {content.hero.intro}
            </p>
            <div className="mt-8">
              <Link href={productsHref} className={primaryCta}>
                {content.cta.primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-[4/5] w-full max-w-[36rem] overflow-hidden rounded-[2rem] bg-[#dfcfb8] shadow-[0_24px_60px_rgba(70,51,30,0.18)]">
            {heroImage ? (
              <>
                <Image
                  src={heroImage.src}
                  alt={heroImage.alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 38vw, 100vw"
                  className="object-cover"
                  style={heroImage.objectPosition ? { objectPosition: heroImage.objectPosition } : undefined}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#1f170f]/25"
                  aria-hidden="true"
                />
              </>
            ) : HeroIcon ? (
              <div className="flex h-full w-full items-center justify-center bg-accent/90 text-contrast">
                <HeroIcon className="h-24 w-24 sm:h-32 sm:w-32" strokeWidth={1.2} aria-hidden="true" />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f1e9de_0%,#faf8f4_11rem,#faf8f4_100%)]">
        <div className="mx-auto w-full max-w-[88rem] px-4 py-14 sm:px-6 sm:py-16 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              {content.varieties.eyebrow}
            </p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">
              {content.varieties.title}
            </h2>
            <p className="mt-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {content.varieties.intro}
            </p>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-3">
            {content.varieties.items.map((item) => (
              <li
                key={item.name}
                className="rounded-[1.25rem] bg-white/85 p-5 shadow-[0_12px_30px_rgba(62,45,27,0.08)]"
              >
                <p className="font-heading text-base font-bold text-contrast">{item.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#faf8f4_0%,#eee6da_100%)]" data-content-section="story">
        <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <p className="w-fit rounded-full bg-[#eadbaf] px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#705700]">
              {content.story.eyebrow}
            </p>
            <h2 className="mt-4 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">
              {content.story.title}
            </h2>
          </div>
          <div>
            <div className="space-y-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {content.story.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {content.story.points.length ? (
              <ul className="mt-6 grid gap-3">
                {content.story.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-base leading-6 text-text">
                    <span
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-contrast"
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      {content.faqs.length > 0 ? (
        <section className="bg-[linear-gradient(180deg,#eee6da_0%,#faf8f4_9rem,#faf8f4_100%)]">
          <div className="mx-auto w-full max-w-[68rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-24">
            <div className="space-y-3">
              {content.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-[1rem] bg-white/90 px-5 py-1 shadow-[0_8px_24px_rgba(62,45,27,0.07)] sm:px-6"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-heading text-base font-bold text-contrast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast sm:text-lg [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span
                      className="text-2xl font-normal text-accent-ink transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-7 text-base leading-7 text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-[linear-gradient(180deg,#faf8f4_0%,#e6d6bd_100%)]">
        <div className="mx-auto w-full max-w-[72rem] px-4 py-16 text-center sm:px-6 lg:py-24">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
            {content.cta.eyebrow}
          </p>
          <h2 className="mx-auto mt-3 max-w-[20ch] text-[clamp(2rem,7vw,4.25rem)] leading-tight text-contrast">
            {content.cta.title}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            {content.cta.body}
          </p>
          <div className="mt-8 flex justify-center">
            <Link href={productsHref} className={primaryCta}>
              {content.cta.primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
