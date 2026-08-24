import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import type { CustomerServiceCopy } from "@/lib/customer-service-content";
import { Container } from "@/components/ui/Container";
import { CustomerServiceKnowledgeBase } from "@/components/customer-service/CustomerServiceKnowledgeBase";

export function CustomerServicePage({ locale, copy }: { locale: Locale; copy: CustomerServiceCopy }) {
  const marketsHref = pagePath("markets", locale);

  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="py-10 sm:py-14 lg:py-16">
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">{copy.eyebrow}</p>
            <h1 className="mt-3 text-[clamp(2.25rem,10vw,4.5rem)] font-bold leading-[0.98] text-text">{copy.title}</h1>
            <p className="mt-5 max-w-2xl text-body-md leading-7 text-muted sm:text-body-lg">{copy.lead}</p>
          </div>
          <div className="mt-7 flex max-w-3xl items-start gap-3 rounded-card border border-accent/40 bg-accent/10 p-4 sm:p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
            <div>
              <h2 className="text-heading-sm">{copy.scopeTitle}</h2>
              <p className="mt-1 text-body-sm leading-6 text-muted">{copy.scopeText}</p>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        <CustomerServiceKnowledgeBase copy={copy} />
      </Container>

      <section className="border-y border-border bg-surface" aria-labelledby="market-contact-title">
        <Container className="py-10 sm:py-14">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">{copy.marketsEyebrow}</p>
              <h2 id="market-contact-title" className="mt-2 text-heading-lg sm:text-heading-xl">{copy.marketsTitle}</h2>
              <p className="mt-3 leading-7 text-muted">{copy.marketsLead}</p>
            </div>
            <Link href={marketsHref} className="inline-flex min-h-11 items-center gap-2 self-start font-heading text-body-sm font-bold text-accent-ink underline underline-offset-4 hover:text-accent-hover sm:self-auto">
              {copy.marketsLinkLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {copy.marketVisits.map((visit) => (
              <Link key={visit.id} href={marketsHref} className="group rounded-card border border-border bg-background p-4 transition-colors hover:border-accent sm:p-5">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-accent-ink">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {visit.day}
                </span>
                <strong className="mt-3 block font-heading text-heading-md text-text">{visit.location}</strong>
                <span className="mt-1 block text-body-sm text-muted">{visit.hours}</span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="customer-contact-title">
        <Container className="py-10 sm:py-14 lg:py-16">
          <div className="max-w-2xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">{copy.contactEyebrow}</p>
            <h2 id="customer-contact-title" className="mt-2 text-heading-lg sm:text-heading-xl">{copy.contactTitle}</h2>
            <p className="mt-3 leading-7 text-muted">{copy.contactLead}</p>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
            <address className="grid content-start gap-3 rounded-panel border border-border bg-surface p-4 not-italic shadow-card sm:p-6">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
                <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.postalAddressLabel}</p><p className="mt-1 leading-6 text-text">{copy.postalAddress}</p></div>
              </div>
              <a href={`mailto:${copy.email}`} className="flex min-h-12 items-center gap-3 rounded-button px-0 text-text underline-offset-4 hover:text-accent-ink hover:underline">
                <Mail className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
                <span><span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.emailLabel}</span><span className="mt-1 block break-all">{copy.email}</span></span>
              </a>
              <a href={copy.phoneHref} className="flex min-h-12 items-center gap-3 rounded-button px-0 text-text underline-offset-4 hover:text-accent-ink hover:underline">
                <Phone className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
                <span><span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.phoneLabel}</span><span className="mt-1 block">{copy.phoneDisplay}</span></span>
              </a>
              <a href={copy.whatsappUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-[#1f6f45] px-5 py-3 font-heading font-bold text-white shadow-button transition-colors hover:bg-[#185a38] sm:w-fit">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {copy.whatsappCta}
              </a>
            </address>

            <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
              <h3 className="flex items-center gap-2 text-heading-md"><Clock3 className="h-5 w-5 text-accent-ink" aria-hidden="true" />{copy.phoneHoursTitle}</h3>
              <dl className="mt-5 divide-y divide-border">
                {copy.phoneHours.map((item) => (
                  <div key={item.day} className="flex min-h-10 items-center justify-between gap-4 py-2 text-body-sm">
                    <dt className="font-semibold text-text">{item.day}</dt>
                    <dd className="text-right text-muted">{item.hours}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 border-t border-border pt-5">
                <h4 className="font-heading text-heading-sm">{copy.additionalTitle}</h4>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-body-sm leading-6 text-muted">
                  {copy.additionalItems.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
