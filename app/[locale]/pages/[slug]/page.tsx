import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Martini, Sun, Wheat, type LucideIcon } from "lucide-react";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import {
  categoryStoryCanonicalSlug,
  isCategoryStoryPageKey,
  pageKeys,
  pageRobots,
  pageSlugs,
  resolvePageKey,
  type CategoryStoryPageKey,
} from "@/lib/pages";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { getCategoryNavigation, getPageBySlug } from "@/lib/queries";
import { findCategoryByCanonicalSlug } from "@/lib/categoryGroups";
import { publicImageUrl } from "@/lib/storage";
import { categories as categoriesPath, category as categoryPath } from "@/lib/routes";
import { Terms } from "./_components/Terms";
import { Privacy } from "./_components/Privacy";
import { ShippingReturns } from "./_components/ShippingReturns";
import { AdditionalTerms } from "./_components/AdditionalTerms";
import { ProcessingAgreement } from "./_components/ProcessingAgreement";
import { CookiePolicy } from "./_components/CookiePolicy";
import { Withdrawal } from "./_components/Withdrawal";
import { MarketRouteMap, type MarketRouteCopy } from "./_components/MarketRouteMap";
import { SquirrelEmptyState } from "@/components/layout/SquirrelEmptyState";
import { CustomerServicePage } from "@/components/customer-service/CustomerServicePage";
import { getCustomerServiceCopy } from "@/lib/customer-service-content";
import { AboutNotenmanPage } from "@/components/content/AboutNotenmanPage";
import { CategoryStoryPage, type CategoryStoryContent } from "@/components/content/CategoryStoryPage";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const categoryStoryDictionaries = { nl, en, fr };

/**
 * Typed accessor for a category story's dictionary content. Indexing
 * categoryStoryDictionaries[locale].categoryStories directly with a
 * CategoryStoryPageKey union infers a union of six distinct literal JSON
 * shapes (each missing the optional fields the others have, e.g. hero.imageAlt),
 * so this normalizes the result to the shared CategoryStoryContent shape.
 */
function getCategoryStoryContent(locale: Locale, key: CategoryStoryPageKey): CategoryStoryContent {
  return categoryStoryDictionaries[locale].categoryStories[key];
}

const categoryStoryHeroImage: Partial<Record<CategoryStoryPageKey, { src: string; objectPosition?: string }>> = {
  // Both source photos are wide "hero" crops with the product bowl/jars off
  // to one side; a plain centered object-cover on this component's portrait
  // frame lands mostly on empty background, so bias the crop toward the
  // product cluster instead.
  categoryNuts: { src: "/hero/hero-nuts-desktop.webp", objectPosition: "80% 50%" },
  categoryHoney: { src: "/hero/hero-honey-desktop.webp", objectPosition: "70% 45%" },
  categoryNutButter: { src: "/home/notenpasta-closeup.webp" },
  // These three categories have no dedicated hero shoot, so this reuses an
  // existing, genuinely appetizing catalog product photo (top-down on the
  // same cream backdrop as every other product image) rather than leaving
  // the generic icon placeholder in place.
  categoryDriedFruit: { src: publicImageUrl("Gedroogd fruit/Gezwafelde abrikozen/gebruikt/FRU-4018-zoete-abrikozen-gezwaveld.webp") },
  categoryMuesliGrains: { src: publicImageUrl("Muesli & Granen/Muesli/gebruikt/MUE-11005-muesli.webp") },
  categorySnacks: { src: publicImageUrl("Snacks/Pittige mix/gebruikt/SNK-6007-gemengd-pikant.webp") },
};

/** Only used if a category above ever loses its heroImage entry. */
const categoryStoryHeroIcon: Partial<Record<CategoryStoryPageKey, LucideIcon>> = {
  categoryDriedFruit: Sun,
  categoryMuesliGrains: Wheat,
  categorySnacks: Martini,
};

const dutchAboutMetadata = {
  title: "Over De Notenman | Vers gebrande noten van de markt",
  description:
    "Maak kennis met Fedor en De Notenman. Vers gebrande noten, gedroogd fruit en meer, op de markt en online vanuit Haaren.",
};

const marketRouteCopy: Record<"nl" | "en" | "fr", MarketRouteCopy & { metadataTitle: string; metadataDescription: string }> = {
  nl: {
    eyebrow: "Vaste marktdagen",
    title: "Vind DeNotenman op de markt",
    lead: "Bekijk per dag waar en wanneer onze kraam staat. De rode stip op de kaart volgt automatisch onze vaste weekroute.",
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
    metadataTitle: "Vind DeNotenman vandaag",
    metadataDescription: "Bekijk de vaste weekroute van De Notenman: Hilvarenbeek op donderdag, Uden op vrijdag, Antwerpen op zaterdag en Haaren op de overige dagen.",
  },
  en: {
    eyebrow: "Fixed market days",
    title: "Find DeNotenman at the market",
    lead: "See where and when our stall is open each day. The red dot on the map automatically follows our weekly route.",
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
    metadataTitle: "Find DeNotenman today",
    metadataDescription: "View De Notenman’s weekly route: Hilvarenbeek on Thursday, Uden on Friday, Antwerp on Saturday and Haaren on all other days.",
  },
  fr: {
    eyebrow: "Jours de marché fixes",
    title: "Trouver DeNotenman au marché",
    lead: "Découvrez chaque jour où et quand notre stand est présent. Le point rouge sur la carte suit automatiquement notre itinéraire fixe.",
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
    metadataTitle: "Trouver DeNotenman aujourd’hui",
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

  if (isCategoryStoryPageKey(key)) {
    const { seo } = getCategoryStoryContent(locale, key);

    return {
      title: seo.title,
      description: seo.description,
      robots: pageRobots(key),
      alternates: {
        canonical: alternates.canonical,
        languages: alternates.languages,
      },
    };
  }

  const customerServiceCopy = key === "faq" ? getCustomerServiceCopy(locale) : null;
  const isDutchAbout = locale === "nl" && key === "about";
  const page = key === "markets" || key === "faq" || isDutchAbout
    ? null
    : await getPageBySlug(slug, locale);
  const title = isDutchAbout
    ? dutchAboutMetadata.title
    : key === "markets"
      ? marketRouteCopy[locale].metadataTitle
      : customerServiceCopy?.metadataTitle ?? page?.title ?? key.charAt(0).toUpperCase() + key.slice(1);

  return {
    title,
    description: isDutchAbout
      ? dutchAboutMetadata.description
      : key === "markets"
        ? marketRouteCopy[locale].metadataDescription
        : customerServiceCopy?.metadataDescription,
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

  if (key === "faq") {
    return <CustomerServicePage locale={locale} copy={getCustomerServiceCopy(locale)} />;
  }

  if (locale === "nl" && key === "about") {
    return <AboutNotenmanPage />;
  }

  if (isCategoryStoryPageKey(key)) {
    const canonicalSlug = categoryStoryCanonicalSlug[key];
    const content = getCategoryStoryContent(locale, key);
    const navigation = await getCategoryNavigation(locale);
    const liveCategory = findCategoryByCanonicalSlug(navigation.categories, canonicalSlug);
    const productsHref = liveCategory
      ? categoryPath(locale, liveCategory.slug)
      : categoriesPath(locale);
    const heroImageSrc = categoryStoryHeroImage[key];

    return (
      <CategoryStoryPage
        content={content}
        productsHref={productsHref}
        assortmentHref={categoriesPath(locale)}
        assortmentLabel={categoryStoryDictionaries[locale].nav.categories}
        heroImage={
          heroImageSrc
            ? {
                src: heroImageSrc.src,
                alt: content.hero.imageAlt ?? content.hero.title,
                objectPosition: heroImageSrc.objectPosition,
              }
            : undefined
        }
        heroIcon={categoryStoryHeroIcon[key]}
      />
    );
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
