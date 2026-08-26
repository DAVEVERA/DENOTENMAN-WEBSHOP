import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, MapPin, MessageCircle } from "lucide-react";
import { categories, category } from "@/lib/routes";
import { pagePath } from "@/lib/pages";

const assortment = [
  "Gebrande en ongebrande noten",
  "Gezouten en ongezouten notenmixen",
  "Pitten en zaden",
  "Gedroogd fruit",
  "Chocolade en chocoladeproducten",
  "Muesli en ontbijtproducten",
  "Notenpasta’s",
  "Honing",
  "Rijstcrackers",
  "Notenmeel en bakproducten",
];

const marketDays = [
  { day: "Donderdag", place: "Hilvarenbeek", time: "08:00–12:00 uur" },
  { day: "Vrijdag", place: "Uden", time: "08:00–12:30 uur" },
  { day: "Zaterdag", place: "Antwerpen", time: "08:00–16:00 uur · Theaterplein" },
];

const faqs = [
  {
    question: "Wie is De Notenman?",
    answer:
      "De Notenman is de notenkraam en webshop van Fedor. Hij staat al meer dan twaalf jaar op de markt en verkoopt noten, notenmixen, gedroogd fruit en andere producten.",
  },
  {
    question: "Waar is De Notenman gevestigd?",
    answer:
      "De webshop en de verwerking van bestellingen zijn gevestigd in Haaren, Noord-Brabant. De Notenman staat daarnaast wekelijks op de markt in Hilvarenbeek, Uden en Antwerpen.",
  },
  {
    question: "Sinds wanneer heeft De Notenman een webshop?",
    answer:
      "De webshop van De Notenman ging op 6 juni 2020 online. Sindsdien kunnen klanten het assortiment ook buiten de marktdagen bestellen.",
  },
  {
    question: "Zijn de producten online hetzelfde als op de markt?",
    answer:
      "Een groot deel van het assortiment van de marktkraam is ook in de webshop verkrijgbaar. Het aanbod kan wisselen door seizoensproducten, nieuwe producten en tijdelijke marktartikelen.",
  },
  {
    question: "Kan ik vragen stellen over ingrediënten en allergenen?",
    answer:
      "Ja. Bij de producten staat informatie over ingrediënten en allergenen. Heb je een specifieke vraag of allergie? Neem dan vóór je bestelling contact met ons op.",
  },
];

const primaryCta =
  "inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-button bg-accent px-6 py-3 font-heading text-base font-bold text-contrast shadow-button transition-[background-color,transform] hover:bg-accent-hover active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast";

const secondaryCta =
  "inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-button border border-border-hover bg-white/80 px-6 py-3 font-heading text-base font-bold text-contrast transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast";

export function AboutNotenmanPage() {
  const assortmentHref = categories("nl");
  const nutsHref = category("nl", "noten");
  const marketsHref = pagePath("markets", "nl");
  const contactHref = pagePath("contact", "nl");
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <article className="overflow-hidden bg-[#f8f5ef] text-text">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="bg-[linear-gradient(180deg,#f8f5ef_0%,#efe6d8_88%,#f1e9de_100%)]">
        <div className="mx-auto grid w-full max-w-[96rem] items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)] lg:gap-14 lg:px-10 lg:py-20 xl:px-14">
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              Op de markt en online
            </p>
            <h1 className="mt-4 max-w-[13ch] text-[clamp(2.5rem,9vw,5.5rem)] leading-[0.94] tracking-heading text-contrast">
              Over De Notenman
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-text sm:text-xl sm:leading-9">
              De Notenman is de notenkraam en webshop van Fedor. Al meer dan twaalf jaar staat hij wekelijks op de markt met vers gebrande noten, notenmixen, gedroogd fruit en andere producten voor thuis, onderweg en bij de borrel.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Je vindt De Notenman op donderdag in Hilvarenbeek, vrijdag in Uden en zaterdag op het Theaterplein in Antwerpen. Kun je niet naar de markt komen? Dan bestel je dezelfde producten eenvoudig online.
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center">
              <Link href={assortmentHref} className={primaryCta}>
                Bekijk het assortiment
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={marketsHref} className={secondaryCta}>
                Vind ons op de markt
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-[4/5] w-full max-w-[36rem] overflow-hidden rounded-[2rem] bg-[#dfcfb8] shadow-[0_24px_60px_rgba(70,51,30,0.18)]">
            <Image
              src="/about/fedor-market.webp"
              alt="Fedor schept gemengde noten in een papieren zak aan de marktkraam."
              fill
              priority
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#1f170f]/25" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f1e9de_0%,#faf8f4_11rem,#faf8f4_100%)]">
        <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              Het marktgevoel
            </p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">
              Noten kopen zoals op de markt
            </h2>
          </div>
          <div className="space-y-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
            <p>
              Wie bij Fedor aan de kraam komt, weet wat hij kan verwachten. Een ruim assortiment, persoonlijk advies en de mogelijkheid om iets nieuws te proberen. Sommige klanten komen voor hun vaste zak cashewnoten. Anderen vragen welke mix goed past bij de borrel of zoeken ingrediënten om mee te bakken.
            </p>
            <p>
              Dat persoonlijke contact hoort bij De Notenman. Geen ingewikkeld verhaal, maar luisteren naar wat je zoekt en je helpen kiezen. Ook als je online bestelt.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#faf8f4_0%,#efe7db_100%)]">
        <div className="mx-auto grid w-full max-w-[96rem] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:py-24 xl:px-14">
          <div className="relative mx-auto aspect-[10/11] w-full max-w-[38rem] overflow-hidden rounded-[1.75rem] bg-white/70">
            <Image
              src="/about/fedor-nutbutters.webp"
              alt="Fedor met een uitgebreide selectie potten noten- en pittenpasta."
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-contain object-bottom"
            />
          </div>
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              De man achter de kraam
            </p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">
              Maak kennis met Fedor
            </h2>
            <div className="mt-6 space-y-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
              <p>
                Fedor is de man achter De Notenman. Hij staat zelf op de markt, kent het assortiment en hoort iedere week rechtstreeks van klanten wat goed in de smaak valt.
              </p>
              <p>
                Die ervaring bepaalt wat er wordt ingekocht en welke producten aan het assortiment worden toegevoegd. Door de jaren heen kwamen er naast noten steeds meer producten bij, waaronder gedroogde vruchten, chocolade, honing, notenpasta’s, rijstcrackers en bakproducten.
              </p>
              <p>
                Fedor probeert nieuwe producten zelf en deelt regelmatig zijn favorieten. Zo blijft het assortiment herkenbaar, maar is er ook geregeld iets nieuws te ontdekken.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#efe7db_0%,#f6f1e9_8rem,#f6f1e9_100%)]">
        <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.72fr_1fr] lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              Sinds 6 juni 2020
            </p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">
              Van marktkraam naar webshop
            </h2>
          </div>
          <div className="relative space-y-5 border-l-2 border-accent/55 pl-6 text-base leading-7 text-muted sm:pl-8 sm:text-lg sm:leading-8">
            <span className="absolute -left-[0.65rem] top-0 inline-flex h-5 w-5 rounded-full border-4 border-[#f6f1e9] bg-accent" aria-hidden="true" />
            <p>
              In 2020 veranderde er veel op de markt. De kraam kon niet altijd op de vaste plaatsen staan en klanten zochten een andere manier om hun noten te bestellen. Bestellingen werden eerst tijdelijk via WhatsApp aangenomen.
            </p>
            <p className="font-heading text-xl font-bold text-contrast">Op 6 juni 2020 ging denotenman.com online.</p>
            <p>
              De webshop maakte het mogelijk om ook buiten de marktdagen bij De Notenman te bestellen. Wat niet veranderde, was de manier van werken. De producten worden nog steeds met aandacht geselecteerd en de bestellingen worden vanuit Haaren verzameld en verpakt.
            </p>
            <p>Je bestelt online, maar achter iedere bestelling staan dezelfde mensen die je ook aan de kraam ontmoet.</p>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f6f1e9_0%,#faf8f4_100%)]">
        <div className="mx-auto grid w-full max-w-[88rem] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
              Geur, smaak en structuur
            </p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">Vers gebrande noten</h2>
            <div className="mt-6 space-y-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
              <p>
                Goede noten herken je aan hun geur, smaak en structuur. Daarom worden de noten vers gebrand. Aan de kraam kun je geregeld zien en ruiken hoe dat gebeurt.
              </p>
              <p>
                Je kunt kiezen uit verschillende soorten noten, gebrand of ongebrand en met of zonder zout. Denk aan cashewnoten, amandelen, pistachenoten, walnoten, pecannoten, macadamianoten en pinda’s.
              </p>
              <p>
                Ook voor notenmixen ben je bij De Notenman aan het juiste adres. Van een eenvoudige ongezouten mix tot een kruidige combinatie voor bij de borrel. Door verschillende smaken en structuren te combineren, is er voor ieder moment een passende mix.
              </p>
            </div>
            <Link href={nutsHref} className={`${primaryCta} mt-8`}>
              Bekijk alle noten
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-[1.75rem] bg-[#eee5d8] p-5 sm:p-8">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Meer dan alleen noten</p>
            <h2 className="mt-3 text-[clamp(1.9rem,5vw,3rem)] leading-tight text-contrast">Een breed assortiment voor ieder moment</h2>
            <p className="mt-5 text-base leading-7 text-muted">De Notenman is begonnen met noten, maar het assortiment is inmiddels een stuk breder. Je vindt bij ons onder andere:</p>
            <ul className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              {assortment.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-text sm:text-base">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-contrast" aria-hidden="true">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-4 text-base leading-7 text-muted">
              <p>
                Gebruik de producten als tussendoortje, bij de borrel, door yoghurt of muesli of als ingrediënt voor een recept. Met noten, zaden, gedroogd fruit en notenmeel maak je bijvoorbeeld zelf notenbrood, granola of een baksel voor het weekend.
              </p>
              <p>
                Het assortiment beweegt mee met de seizoenen. Nieuwe oogst Spaanse vijgen, producten voor thuisbakkers en wisselende notenmixen krijgen op het juiste moment een plek aan de kraam en in de webshop.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#faf8f4_0%,#eee6da_100%)]">
        <div className="mx-auto grid w-full max-w-[88rem] items-start gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.75fr_1fr] lg:gap-16 lg:px-10 lg:py-24">
          <div className="flex min-h-52 items-center justify-center rounded-[1.75rem] bg-accent/90 p-8 text-contrast sm:min-h-64">
            <MessageCircle className="h-16 w-16 sm:h-20 sm:w-20" strokeWidth={1.4} aria-hidden="true" />
          </div>
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Een duidelijk antwoord</p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">Persoonlijk advies, ook online</h2>
            <div className="mt-6 space-y-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
              <p>Aan de kraam stel je een vraag gewoon aan Fedor. Online moet dat net zo makkelijk zijn.</p>
              <p>
                Daarom vind je bij de producten duidelijke informatie over de inhoud, ingrediënten en allergenen. Wil je weten welke noten passen bij een bepaald recept? Zoek je een mix zonder zout? Of heb je een vraag over een ingrediënt? Neem dan gerust contact met ons op.
              </p>
              <p>We zoeken het voor je uit en geven een duidelijk antwoord. Zo kun je met een goed gevoel bestellen.</p>
            </div>
            <Link href={contactHref} className={`${primaryCta} mt-8`}>
              Stel je vraag
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#eee6da_0%,#f8f5ef_9rem,#f8f5ef_100%)]">
        <div className="mx-auto w-full max-w-[96rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-24 xl:px-14">
          <div className="max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Iedere week onderweg</p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">Waar vind je De Notenman?</h2>
            <p className="mt-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">Iedere week staat De Notenman op drie vaste markten:</p>
          </div>

          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {marketDays.map((market) => (
              <li key={market.place} className="rounded-[1.25rem] bg-white/85 p-5 shadow-[0_12px_30px_rgba(62,45,27,0.08)]">
                <div className="flex items-center gap-2 font-heading text-sm font-bold text-accent-ink">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {market.day}
                </div>
                <p className="mt-3 flex items-center gap-2 font-heading text-xl font-bold text-contrast">
                  <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {market.place}
                </p>
                <p className="mt-2 pl-7 text-base text-muted">{market.time}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 overflow-hidden rounded-[1.5rem] bg-white p-2 shadow-[0_16px_40px_rgba(62,45,27,0.09)] sm:p-4">
            <Image
              src="/about/market-route.webp"
              alt="Route van De Notenman tussen Antwerpen, Hilvarenbeek, Uden en Haaren."
              width={1672}
              height={668}
              sizes="100vw"
              className="h-auto w-full object-contain"
            />
          </div>
          <p className="mt-6 max-w-4xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Op de markt kun je het assortiment bekijken, advies vragen en nieuwe producten ontdekken. De webshop is er voor de andere momenten. Zo kies je zelf of je langskomt of vanuit huis bestelt.
          </p>
          <Link href={marketsHref} className={`${secondaryCta} mt-7`}>
            Bekijk de marktdagen
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f8f5ef_0%,#eee6da_100%)]">
        <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Van kraam tot voordeur</p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">Dezelfde aandacht, waar je ook bestelt</h2>
          </div>
          <div className="space-y-5 text-base leading-7 text-muted sm:text-lg sm:leading-8">
            <p>De markt en de webshop horen bij elkaar. Op de markt ontstaat het contact met klanten. In Haaren worden de online bestellingen verwerkt en zorgvuldig verpakt.</p>
            <p>De manier waarop je bestelt verschilt, maar de aandacht voor het product niet. Je krijgt dezelfde noten, dezelfde kennis van het assortiment en dezelfde mogelijkheid om een vraag te stellen.</p>
            <p className="font-heading text-xl font-bold text-contrast">Dat is De Notenman: vers gebrande noten, een breed assortiment en persoonlijk contact.</p>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#eee6da_0%,#faf8f4_9rem,#faf8f4_100%)]">
        <div className="mx-auto w-full max-w-[68rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-24">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Goed om te weten</p>
          <h2 className="mt-3 text-[clamp(2rem,6vw,3.75rem)] leading-tight text-contrast">Veelgestelde vragen over De Notenman</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-[1rem] bg-white/90 px-5 py-1 shadow-[0_8px_24px_rgba(62,45,27,0.07)] sm:px-6">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-heading text-base font-bold text-contrast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast sm:text-lg [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span className="text-2xl font-normal text-accent-ink transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="pb-5 pr-7 text-base leading-7 text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#faf8f4_0%,#e6d6bd_100%)]">
        <div className="mx-auto w-full max-w-[72rem] px-4 py-16 text-center sm:px-6 lg:py-24">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Zelf kennismaken met De Notenman?</p>
          <h2 className="mx-auto mt-3 max-w-[18ch] text-[clamp(2rem,7vw,4.25rem)] leading-tight text-contrast">Van vaste favoriet tot iets nieuws voor op tafel</h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-8">Bekijk het assortiment en kies jouw favoriete noten, mixen en gedroogde vruchten. Wil je liever eerst rondkijken of iets proeven? Kom dan langs op de markt in Hilvarenbeek, Uden of Antwerpen.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 min-[480px]:flex-row min-[480px]:items-center">
            <Link href={assortmentHref} className={primaryCta}>
              Bekijk het assortiment
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={marketsHref} className={secondaryCta}>Vind ons op de markt</Link>
          </div>
        </div>
      </section>
    </article>
  );
}
