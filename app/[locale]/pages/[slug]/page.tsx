import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { pageKeys, pageRobots, pageSlugs, resolvePageKey } from "@/lib/pages";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { getPageBySlug } from "@/lib/queries";
import { Terms } from "./_components/Terms";
import { Privacy } from "./_components/Privacy";
import { ShippingReturns } from "./_components/ShippingReturns";
import { AdditionalTerms } from "./_components/AdditionalTerms";
import { ProcessingAgreement } from "./_components/ProcessingAgreement";
import { CookiePolicy } from "./_components/CookiePolicy";
import { Withdrawal } from "./_components/Withdrawal";
import { MarketRouteMap, type MarketRouteCopy } from "./_components/MarketRouteMap";
import { SquirrelEmptyState } from "@/components/layout/SquirrelEmptyState";

const marketRouteCopy: Record<"nl" | "en" | "fr", MarketRouteCopy & { metadataTitle: string; metadataDescription: string }> = {
  nl: {
    eyebrow: "De vaste weekroute",
    title: "Waar is De Notenman?",
    lead: "Van de markt tot onze thuisbasis: bekijk waar je De Notenman vandaag vindt. De rode stip volgt automatisch onze vaste weekroute.",
    today: "Vandaag",
    locating: "Bestemming bepalen…",
    scheduleTitle: "Hier staan we deze week",
    scheduleText: "Donderdag, vrijdag en zaterdag staan we op de markt. De overige dagen vind je ons in Haaren.",
    swipeHint: "",
    mapAlt: "Getekende routekaart tussen Antwerpen, Hilvarenbeek, Uden en Haaren.",
    mapScrollLabel: "Routekaart. Horizontaal scrollen is mogelijk.",
    weekdayNames: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"],
    scheduleDays: {
      hilvarenbeek: "Donderdag",
      uden: "Vrijdag",
      antwerpen: "Zaterdag",
      haaren: "Zondag t/m woensdag",
    },
    metadataTitle: "Waar is De Notenman vandaag?",
    metadataDescription: "Bekijk de vaste weekroute van De Notenman: Hilvarenbeek op donderdag, Uden op vrijdag, Antwerpen op zaterdag en Haaren op de overige dagen.",
  },
  en: {
    eyebrow: "Our weekly route",
    title: "Where is De Notenman?",
    lead: "From the market to our home base: see where to find De Notenman today. The red dot automatically follows our weekly route.",
    today: "Today",
    locating: "Finding today’s location…",
    scheduleTitle: "Where to find us this week",
    scheduleText: "We visit the markets on Thursday, Friday and Saturday. On the other days you can find us in Haaren.",
    swipeHint: "Swipe across the map to see the complete route",
    mapAlt: "Illustrated route map between Antwerp, Hilvarenbeek, Uden and Haaren.",
    mapScrollLabel: "Route map. Horizontal scrolling is available.",
    weekdayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    scheduleDays: {
      hilvarenbeek: "Thursday",
      uden: "Friday",
      antwerpen: "Saturday",
      haaren: "Sunday through Wednesday",
    },
    metadataTitle: "Where is De Notenman today?",
    metadataDescription: "View De Notenman’s weekly route: Hilvarenbeek on Thursday, Uden on Friday, Antwerp on Saturday and Haaren on all other days.",
  },
  fr: {
    eyebrow: "Notre itinéraire hebdomadaire",
    title: "Où est De Notenman ?",
    lead: "Du marché à notre base : découvrez où trouver De Notenman aujourd’hui. Le point rouge suit automatiquement notre itinéraire fixe.",
    today: "Aujourd’hui",
    locating: "Recherche du lieu du jour…",
    scheduleTitle: "Où nous trouver cette semaine",
    scheduleText: "Nous sommes au marché le jeudi, le vendredi et le samedi. Les autres jours, vous nous trouverez à Haaren.",
    swipeHint: "Faites glisser la carte pour voir l’itinéraire complet",
    mapAlt: "Carte illustrée de l’itinéraire entre Anvers, Hilvarenbeek, Uden et Haaren.",
    mapScrollLabel: "Carte de l’itinéraire. Le défilement horizontal est disponible.",
    weekdayNames: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
    scheduleDays: {
      hilvarenbeek: "Jeudi",
      uden: "Vendredi",
      antwerpen: "Samedi",
      haaren: "Du dimanche au mercredi",
    },
    metadataTitle: "Où est De Notenman aujourd’hui ?",
    metadataDescription: "Consultez l’itinéraire hebdomadaire de De Notenman : Hilvarenbeek le jeudi, Uden le vendredi, Anvers le samedi et Haaren les autres jours.",
  },
};

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    pageKeys.map((key) => ({ locale, slug: pageSlugs[key][locale] }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const locale = rawLocale;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    return {};
  }

  const alternates = await getAlternates(locale, { type: "page", key });

  if (!alternates) {
    return {};
  }

  const page = key === "markets" ? null : await getPageBySlug(slug, locale);
  const title = key === "markets"
    ? marketRouteCopy[locale].metadataTitle
    : page?.title || key.charAt(0).toUpperCase() + key.slice(1);

  return {
    title,
    description: key === "markets" ? marketRouteCopy[locale].metadataDescription : undefined,
    robots: pageRobots(key),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    notFound();
  }

  if (key === "markets") {
    return <MarketRouteMap copy={marketRouteCopy[locale]} />;
  }

  // 1. Render custom high-quality statically-styled Dutch components
  if (locale === "nl") {
    if (key === "terms") {
      return (
        <Container className="py-12">
          <Terms locale={locale} />
        </Container>
      );
    }
    if (key === "privacy") {
      return (
        <Container className="py-12">
          <Privacy locale={locale} />
        </Container>
      );
    }
    if (key === "shippingReturns") {
      return (
        <Container className="py-12">
          <ShippingReturns locale={locale} />
        </Container>
      );
    }
    if (key === "additionalTerms") {
      return (
        <Container className="py-12">
          <AdditionalTerms locale={locale} />
        </Container>
      );
    }
    if (key === "processingAgreement") {
      return (
        <Container className="py-12">
          <ProcessingAgreement locale={locale} />
        </Container>
      );
    }
    if (key === "cookies") {
      return (
        <Container className="py-12">
          <CookiePolicy locale={locale} />
        </Container>
      );
    }
    if (key === "withdrawal") {
      return (
        <Container className="py-12">
          <Withdrawal locale={locale} />
        </Container>
      );
    }
  }

  // 2. Fetch page translation dynamically from the database
  const page = await getPageBySlug(slug, locale);

  if (page && page.body) {
    return (
      <Container className="py-12">
        <article className="prose max-w-4xl mx-auto text-text">
          <h1 className="text-4xl font-bold text-contrast mb-8">{page.title}</h1>
          <div className="leading-relaxed whitespace-pre-wrap">{page.body}</div>
        </article>
      </Container>
    );
  }

  // 3. Keep known-but-empty content pages useful instead of rendering a dead end.
  return <SquirrelEmptyState locale={locale} />;
}
