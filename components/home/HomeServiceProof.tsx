import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";

export type HomeMarketVisit = {
  id: string;
  day: string;
  location: string;
  hours: string;
};

export type HomeServiceProofProps = {
  eyebrow: string;
  title: string;
  intro: string;
  markets: HomeMarketVisit[];
  ctaLabel: string;
  ctaHref: string;
};

export function HomeServiceProof({
  eyebrow,
  title,
  intro,
  markets,
  ctaLabel,
  ctaHref,
}: HomeServiceProofProps) {
  if (!markets.length) return null;

  return (
    <section className="bg-[linear-gradient(180deg,#faf8f4_0%,#f6f3ee_7rem,#f6f3ee_100%)] py-10 sm:py-14 lg:py-16" aria-labelledby="home-markets-title">
      <Container fullWidth className="px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-16">
        <div className="max-w-2xl">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
            {eyebrow}
          </p>
          <h2 id="home-markets-title" className="mt-2 text-[clamp(1.75rem,7vw,2.75rem)] leading-tight text-contrast">
            {title}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted">{intro}</p>
        </div>

        <ul className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {markets.map((market) => (
            <li key={market.id} className="rounded-card border border-white/60 bg-background/75 p-5 shadow-[0_14px_35px_rgba(47,36,22,0.06)] backdrop-blur-sm">
              <div className="flex items-center gap-2 font-heading text-sm font-bold text-accent-ink">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
                <span>{market.day}</span>
              </div>
              <div className="mt-5 flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-contrast" aria-hidden="true" />
                <span className="font-heading text-lg font-bold leading-tight text-contrast">{market.location}</span>
              </div>
              <div className="mt-3 flex items-center gap-3 text-base text-muted">
                <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{market.hours}</span>
              </div>
            </li>
          ))}
        </ul>

        <Link
          href={ctaHref}
          className="mt-6 inline-flex min-h-11 touch-manipulation items-center gap-2 py-2 font-heading text-sm font-bold text-contrast underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-ink"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}
