import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { getCategoryNavigation, getHomeLandingProducts } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { buildStorefrontMetadata } from "@/lib/storefront-seo";
import {
  categories as categoriesPath,
  category as categoryPath,
} from "@/lib/routes";
import { pagePath } from "@/lib/pages";
import {
  getAnnouncementTickerCopy,
  getCustomerServiceCopy,
} from "@/lib/customer-service-content";
import { SiteShell } from "@/components/layout/SiteShell";
import { AnnouncementTicker } from "@/components/home/AnnouncementTicker";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeCategoryEntrances } from "@/components/home/HomeCategoryEntrances";
import { HomeNutButterStory } from "@/components/home/HomeNutButterStory";
import { USPBar } from "@/components/ui/USPBar";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";
import { HomeCraftStory } from "@/components/home/HomeCraftStory";
import { HomeHoneyStory } from "@/components/home/HomeHoneyStory";
import { HomeServiceProof } from "@/components/home/HomeServiceProof";
import { HomeAssortmentCta } from "@/components/home/HomeAssortmentCta";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import type { NavigationCategoryDto } from "@/lib/categoryGroups";
import { HOME_CATEGORY_ENTRANCES } from "@/lib/home-category-entrances";

const dictionaries = { nl, en, fr };

function findNavigationCategory(
  categories: NavigationCategoryDto[],
  canonicalSlug: string,
): NavigationCategoryDto | undefined {
  for (const category of categories) {
    if (category.canonicalSlug === canonicalSlug) return category;
    const child = findNavigationCategory(category.children, canonicalSlug);
    if (child) return child;
  }

  return undefined;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) return {};

  const dictionary = dictionaries[rawLocale];
  const alternates = await getAlternates(rawLocale, { type: "home" });

  return buildStorefrontMetadata({
    title: dictionary.seo.home.title,
    description: dictionary.seo.home.description,
    alternates,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) notFound();

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const assortmentHref = categoriesPath(locale);
  const marketsHref = pagePath("markets", locale);
  const announcementCopy = getAnnouncementTickerCopy(locale, dictionary.usp);
  const [alternates, navigation, homeProducts] = await Promise.all([
    getAlternates(locale, { type: "home" }),
    getCategoryNavigation(locale),
    getHomeLandingProducts(locale),
  ]);
  const customerService = getCustomerServiceCopy(locale);
  const homepageCategories = HOME_CATEGORY_ENTRANCES.flatMap(
    ({ canonicalSlug }) => {
      const category = findNavigationCategory(
        navigation.categories,
        canonicalSlug,
      );

      return category
        ? [
            {
              id: category.id,
              name: category.name,
              href: categoryPath(locale, category.slug),
              imageSrc: homeProducts.categoryImages[canonicalSlug],
            },
          ]
        : [];
    },
  );
  const categoryHref = (canonicalSlug: string) => {
    const category = findNavigationCategory(
      navigation.categories,
      canonicalSlug,
    );

    return category ? categoryPath(locale, category.slug) : assortmentHref;
  };
  const nutsHref = categoryHref("noten");
  const honeyHref = categoryHref("honing");
  const nutButterHref = categoryHref("notenpasta-s");
  const heroSlides = dictionary.home.hero.slides.map(
    ({ category, cta, ...slide }) => {
      const navigationCategory = findNavigationCategory(
        navigation.categories,
        category,
      );

      return {
        ...slide,
        ctaLabel: cta,
        ctaHref: navigationCategory
          ? categoryPath(locale, navigationCategory.slug)
          : assortmentHref,
      };
    },
  );
  const shippingUsp = announcementCopy.items.find(
    (item) => item.id === "free-shipping",
  )?.text;

  const productCardCopy = {
    outOfStock: dictionary.product.outOfStock,
    addToFavorites: dictionary.product.addToFavorites,
    removeFromFavorites: dictionary.product.removeFromFavorites,
    openQuickView: dictionary.product.openQuickView,
    quickOrder: dictionary.product.quickOrder,
    moreInfo: dictionary.product.moreInfo,
    stockAlert: dictionary.product.stockAlert,
    loadingQuickView: dictionary.product.loadingQuickView,
  };
  const productQuickViewCopy = {
    selectQuantity: dictionary.product.selectQuantity,
    closeQuickView: dictionary.product.closeQuickView,
    outOfStock: dictionary.product.outOfStock,
    inStock: dictionary.product.inStock,
    quantity: dictionary.product.quantity,
    added: dictionary.product.addedToCart,
    goToCart: dictionary.product.goToCart,
    continueShopping: dictionary.product.continueShopping,
    order: dictionary.product.order,
    quickOrder: dictionary.product.quickOrder,
    moreInfo: dictionary.product.moreInfo,
    decrease: dictionary.cart.decrease,
    increase: dictionary.cart.increase,
  };

  return (
    <>
      <AnnouncementTicker copy={announcementCopy} />
      <SiteShell
        locale={locale}
        dictionary={dictionary}
        languages={alternates?.languages ?? {}}
      >
        <HomeHero
          carouselLabel={dictionary.home.hero.carouselLabel}
          slideLabel={dictionary.home.hero.slideLabel}
          slides={heroSlides}
        />

        <HomeCategoryEntrances
          eyebrow={dictionary.home.categories.eyebrow}
          title={dictionary.home.categories.title}
          intro={dictionary.home.categories.intro}
          viewAllLabel={dictionary.home.categories.viewAll}
          viewAllHref={assortmentHref}
          categories={homepageCategories}
        />

        <USPBar dictionary={dictionary} shipping={shippingUsp} />

        <HomeCraftStory
          eyebrow={dictionary.home.story.eyebrow}
          title={dictionary.home.story.title}
          body={dictionary.home.story.body}
          points={[
            dictionary.home.story.proofOne,
            dictionary.home.story.proofTwo,
            dictionary.home.story.proofThree,
          ]}
          imageSrc="/home/de-notenman-marktbak.webp"
          imageAlt={dictionary.home.story.imageAlt}
          ctaLabel={dictionary.home.story.cta}
          ctaHref={pagePath("about", locale)}
        />

        <HomeFeaturedProducts
          products={homeProducts.nuts}
          locale={locale}
          href={nutsHref}
          sectionId="home-nuts"
          tone="from-craft"
          copy={{
            ...dictionary.home.nutsProducts,
            card: productCardCopy,
            quickView: productQuickViewCopy,
          }}
        />

        <HomeHoneyStory
          eyebrow={dictionary.home.honeyStory.eyebrow}
          title={dictionary.home.honeyStory.title}
          body={dictionary.home.honeyStory.body}
          imageAlt={dictionary.home.honeyStory.imageAlt}
          ctaLabel={dictionary.home.honeyStory.cta}
          ctaHref={honeyHref}
        />

        <HomeFeaturedProducts
          products={homeProducts.honey}
          locale={locale}
          href={honeyHref}
          sectionId="home-honey"
          tone="from-honey"
          copy={{
            ...dictionary.home.honeyProducts,
            card: productCardCopy,
            quickView: productQuickViewCopy,
          }}
        />

        <HomeNutButterStory
          eyebrow={dictionary.home.nutButter.eyebrow}
          title={dictionary.home.nutButter.title}
          body={dictionary.home.nutButter.body}
          detail={dictionary.home.nutButter.detail}
          highlights={dictionary.home.nutButter.highlights}
          imageAlt={dictionary.home.nutButter.imageAlt}
          ctaLabel={dictionary.home.nutButter.cta}
          ctaHref={nutButterHref}
        />

        <HomeFeaturedProducts
          products={homeProducts.nutButters}
          locale={locale}
          href={nutButterHref}
          sectionId="home-nut-butters"
          tone="from-nut-butter"
          copy={{
            ...dictionary.home.nutButterProducts,
            card: productCardCopy,
            quickView: productQuickViewCopy,
          }}
        />

        <HomeServiceProof
          eyebrow={dictionary.home.service.eyebrow}
          title={dictionary.home.service.title}
          intro={dictionary.home.service.intro}
          markets={customerService.marketVisits}
          ctaLabel={dictionary.home.service.viewAll}
          ctaHref={marketsHref}
        />

        <HomeAssortmentCta
          title={dictionary.home.assortment.title}
          body={dictionary.home.assortment.body}
          ctaLabel={dictionary.home.assortment.cta}
          ctaHref={assortmentHref}
        />
      </SiteShell>
    </>
  );
}
