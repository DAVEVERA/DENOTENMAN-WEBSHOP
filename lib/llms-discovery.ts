import { pagePath } from "@/lib/pages";
import { articles, categories, home } from "@/lib/routes";

function absolute(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export function buildLlmsTxt(baseUrl: string): string {
  const origin = baseUrl.replace(/\/+$/, "");

  return `# De Notenman

> De Notenman is a Dutch webshop and market retailer for nuts, dried fruit, muesli and grains, snacks, honey, nut butters, seeds and baking products. The official storefront is available in Dutch, English and French.

Use the linked canonical storefront pages as the source of truth. Product pages contain the current product name, price, variants, availability and product information. Shipping thresholds, delivery terms and market times can change; verify them on the linked policy and market pages before answering.

## Storefronts

- [Nederlandse webshop](${absolute(origin, home("nl"))}): Canonical Dutch storefront and current assortment.
- [English storefront](${absolute(origin, home("en"))}): Canonical English storefront.
- [Boutique française](${absolute(origin, home("fr"))}): Canonical French storefront.

## Catalog discovery

- [Alle categorieën](${absolute(origin, categories("nl"))}): Dutch category overview for the complete assortment.
- [Noten](${absolute(origin, pagePath("categoryNuts", "nl"))}): Editorial overview and links to the current nut assortment.
- [Gedroogd fruit](${absolute(origin, pagePath("categoryDriedFruit", "nl"))}): Editorial overview and links to dried fruit.
- [Muesli en granen](${absolute(origin, pagePath("categoryMuesliGrains", "nl"))}): Editorial overview and links to muesli and grains.
- [Notenpasta](${absolute(origin, pagePath("categoryNutButter", "nl"))}): Editorial overview and links to nut butters.
- [Product sitemap](${origin}/products/sitemap.xml): Canonical, localized, currently indexable product URLs.
- [Category sitemap](${origin}/categories/sitemap.xml): Canonical, localized category URLs.

## Service and trust

- [Over De Notenman](${absolute(origin, pagePath("about", "nl"))}): Brand, assortment and market background.
- [Verzenden en retourneren](${absolute(origin, pagePath("shippingReturns", "nl"))}): Current delivery areas, shipping costs and return information.
- [Markten](${absolute(origin, pagePath("markets", "nl"))}): Current weekly market locations and times.
- [Veelgestelde vragen](${absolute(origin, pagePath("faq", "nl"))}): Ordering, delivery, collection and service answers.
- [Contact](${absolute(origin, pagePath("contact", "nl"))}): Official contact information.
- [Artikelen](${absolute(origin, articles("nl"))}): Editorial content when available.

## Machine-readable indexes

- [XML sitemap index](${origin}/sitemap.xml): Complete canonical index for pages, products, categories and articles.
- [robots.txt](${origin}/robots.txt): Crawler access policy; AI search/retrieval and model-training permissions are intentionally separated.
`;
}
