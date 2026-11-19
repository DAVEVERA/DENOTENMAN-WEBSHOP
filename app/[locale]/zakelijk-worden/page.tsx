import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList, Mail, MapPin, Phone, Truck, MessageCircle } from "lucide-react";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import { CUSTOMER_SERVICE_PHONE_DISPLAY, CUSTOMER_SERVICE_PHONE_E164, CUSTOMER_SERVICE_WHATSAPP_URL } from "@/lib/customer-service";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { pagePath } from "@/lib/pages";
import { BASE_URL } from "@/lib/routes";
import { BusinessInquiryForm } from "./BusinessInquiryForm";

const pageUrl = `${BASE_URL.replace(/\/$/, "")}/nl/zakelijk-worden`;

export const metadata: Metadata = {
  title: "Zakelijk klant worden | De Notenman",
  description: "Een vaste bestellijst voor jouw bedrijf, persoonlijk contact en bestellen wanneer het uitkomt. Vraag een zakelijke samenwerking met De Notenman aan.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Zakelijk bestellen bij De Notenman",
    description: "Bespreek jouw assortiment, ontvang een vaste bestellijst en bestel met de aantallen die je nodig hebt.",
    url: pageUrl,
    siteName: "De Notenman",
    locale: "nl_NL",
    type: "website",
  },
};

const steps = [
  {
    number: "01",
    title: "Vertel ons wat je nodig hebt",
    text: "Laat weten voor welk bedrijf je bestelt, welke producten je zoekt en hoe vaak je ongeveer wilt bestellen. We bespreken samen wat past.",
  },
  {
    number: "02",
    title: "Wij zetten jouw bestellijst klaar",
    text: "De Notenman maakt een persoonlijke lijst met producten, eenheden en prijzen. Je ontvangt toegang tot jouw zakelijke omgeving zodra de lijst klaarstaat.",
  },
  {
    number: "03",
    title: "Pas aantallen aan en bestel",
    text: "Je gebruikt de lijst opnieuw, past per bestelling de aantallen aan en rekent online af. Een product dat je deze keer niet nodig hebt, blijft op de lijst staan.",
  },
  {
    number: "04",
    title: "Ontvang of haal je bestelling op",
    text: "Bezorging aan de deur of afhalen bij De Notenman op de markt: we spreken vooraf af wat voor jouw bedrijf mogelijk en praktisch is.",
  },
] as const;

export default async function BusinessInformationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "nl") redirect("/nl/zakelijk-worden");

  return (
    <SiteShell locale="nl" dictionary={nl} languages={{ nl: "/nl/zakelijk-worden" }}>
      <div className="bg-background">
        <section className="relative overflow-hidden bg-[#203327] text-white">
          <div className="absolute inset-0 opacity-25">
            <Image src="/hero/hero-nuts-desktop.webp" alt="" fill preload sizes="100vw" className="object-cover object-center" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#203327] via-[#203327]/90 to-[#203327]/50" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#e9cf83]">Voor bedrijven</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl font-bold leading-tight sm:text-6xl">Zakelijk bestellen, persoonlijk geregeld.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/90">Een assortiment dat bij jouw bedrijf past. Een vaste bestellijst die je telkens opnieuw kunt gebruiken. En direct contact met De Notenman als je iets wilt afstemmen.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#zakelijke-aanvraag" className="inline-flex min-h-12 items-center gap-2 rounded-button bg-accent px-6 py-3 font-heading font-bold text-contrast hover:bg-accent-hover">Bespreek de mogelijkheden <ArrowRight className="h-5 w-5" aria-hidden="true" /></a>
              <Link href="/nl/zakelijk/inloggen" className="inline-flex min-h-12 items-center rounded-button border border-white/70 px-6 py-3 font-heading font-bold text-white hover:bg-white/10">Al klant? Log in</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-3 sm:px-6 sm:py-20" aria-label="Voordelen van zakelijk bestellen">
          <div className="rounded-panel border border-border bg-surface p-6 shadow-card"><ClipboardList className="h-8 w-8 text-accent-hover" aria-hidden="true" /><h2 className="mt-4 font-heading text-heading-sm font-bold">Jouw vaste bestellijst</h2><p className="mt-2 leading-relaxed text-muted">Je hoeft je assortiment niet bij elke bestelling opnieuw samen te stellen.</p></div>
          <div className="rounded-panel border border-border bg-surface p-6 shadow-card"><MessageCircle className="h-8 w-8 text-accent-hover" aria-hidden="true" /><h2 className="mt-4 font-heading text-heading-sm font-bold">Persoonlijk contact</h2><p className="mt-2 leading-relaxed text-muted">Bespreek producten, hoeveelheden en praktische wensen rechtstreeks met ons.</p></div>
          <div className="rounded-panel border border-border bg-surface p-6 shadow-card"><Truck className="h-8 w-8 text-accent-hover" aria-hidden="true" /><h2 className="mt-4 font-heading text-heading-sm font-bold">Bezorging of afhalen</h2><p className="mt-2 leading-relaxed text-muted">We stemmen samen af hoe je jouw bestellingen ontvangt of ophaalt.</p></div>
        </section>

        <section className="border-y border-border bg-surface" aria-labelledby="business-steps-title">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-accent-hover">Zo werkt het</p>
            <h2 id="business-steps-title" className="mt-2 max-w-2xl font-heading text-heading-lg font-bold">Van eerste gesprek tot een bestelling die bij je past</h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-muted">Je bestellijst is een terugkerend vertrekpunt. De Notenman zet producten en prijzen voor je klaar; jij bepaalt bij elke bestelling de aantallen. Zo bestel je snel, zonder opnieuw te beginnen.</p>
            <ol className="mt-9 grid gap-6 sm:grid-cols-2">
              {steps.map((step) => <li key={step.number} className="rounded-panel border border-border bg-background p-6"><span className="font-heading text-2xl font-bold text-accent-hover">{step.number}</span><h3 className="mt-3 font-heading text-heading-sm font-bold">{step.title}</h3><p className="mt-2 leading-relaxed text-muted">{step.text}</p></li>)}
            </ol>
            <p className="mt-6 text-body-sm text-muted">Een afhaaldag kan in de zakelijke omgeving als voorkeur worden aangegeven. De definitieve bezorg- of afhaalafspraak stemmen we met je af.</p>
          </div>
        </section>

        <section id="zakelijke-aanvraag" className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]" aria-labelledby="business-contact-title">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-accent-hover">Kennismaken</p>
            <h2 id="business-contact-title" className="mt-2 font-heading text-heading-lg font-bold">Wat kunnen we voor jouw bedrijf betekenen?</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">Vertel ons kort wat je zoekt. We nemen contact met je op om het assortiment, de bestellijst en de gewenste bezorging of afhaling te bespreken.</p>
            <BusinessInquiryForm />
          </div>
          <aside className="rounded-panel border border-border bg-surface p-6 shadow-card sm:p-8" aria-label="Zakelijke contactmogelijkheden">
            <h3 className="font-heading text-heading-sm font-bold">Liever direct contact?</h3>
            <p className="mt-2 text-body-sm leading-relaxed text-muted">Je kunt ons ook rechtstreeks bereiken. Bellen kan tijdens de telefonische openingstijden.</p>
            <ul className="mt-5 space-y-5">
              <li><a className="flex min-h-11 items-center gap-3 font-semibold text-accent-hover underline-offset-4 hover:underline" href={`mailto:${LEGAL_IDENTITY.email}?subject=Zakelijke%20aanvraag`}><Mail className="h-5 w-5 shrink-0" aria-hidden="true" />{LEGAL_IDENTITY.email}</a></li>
              <li><a className="flex min-h-11 items-center gap-3 font-semibold text-accent-hover underline-offset-4 hover:underline" href={`tel:${CUSTOMER_SERVICE_PHONE_E164}`}><Phone className="h-5 w-5 shrink-0" aria-hidden="true" />{CUSTOMER_SERVICE_PHONE_DISPLAY}</a></li>
              <li><a className="flex min-h-11 items-center gap-3 font-semibold text-accent-hover underline-offset-4 hover:underline" href={CUSTOMER_SERVICE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />Stuur een WhatsApp-bericht</a></li>
              <li><Link className="flex min-h-11 items-center gap-3 font-semibold text-accent-hover underline-offset-4 hover:underline" href={pagePath("markets", "nl")}><MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />Bekijk onze marktdagen</Link></li>
            </ul>
            <p className="mt-6 border-t border-border pt-5 text-body-sm text-muted">Telefonisch bereikbaar op maandag tot en met vrijdag van 11.00 tot 15.00 uur.</p>
          </aside>
        </section>
      </div>
    </SiteShell>
  );
}
