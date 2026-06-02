import type { MarketLocation } from "./market-locations";
import type { StorefrontProduct } from "./products";

export const SITE_BASE_URL = "https://denotenman.com";
export const SITE_NAME = "De Notenman";
export const DEFAULT_OG_IMAGE = "/Notenman_onlylogo.png";

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${SITE_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function serializeJsonLd(data: Record<string, unknown> | Array<Record<string, unknown>>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function cleanSeoText(text?: string | null) {
  return text?.replace(/^\s*ingredienten?\s*:\s*/i, "").trim() || null;
}

export function getProductPrice(product: StorefrontProduct) {
  return product.weights[0]?.price ?? product.variants[0]?.price ?? product.basePrice;
}

export function getProductDescription(product: StorefrontProduct) {
  return (
    cleanSeoText(product.description) ??
    `Koop ${product.name} online bij De Notenman. ${product.categoryLabel} wordt dagvers geselecteerd, veilig afgerekend en snel geleverd.`
  );
}

export function getAvailabilityUrl(stockLabel: string) {
  return stockLabel.toLowerCase().includes("niet")
    ? "https://schema.org/OutOfStock"
    : "https://schema.org/InStock";
}

export function getBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function getOrganizationJsonLd(locations: readonly MarketLocation[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_BASE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_BASE_URL,
        logo: absoluteUrl(DEFAULT_OG_IMAGE),
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_BASE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_BASE_URL,
        publisher: {
          "@id": `${SITE_BASE_URL}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_BASE_URL}/zoeken?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Store",
        "@id": `${SITE_BASE_URL}/#store`,
        name: SITE_NAME,
        url: SITE_BASE_URL,
        image: absoluteUrl(DEFAULT_OG_IMAGE),
        description: "De Notenman verkoopt dagverse noten, pitten, zaden, mixen en gedroogd fruit via de webshop en op de markt.",
        areaServed: ["Nederland", "Belgie"],
        department: locations.map((location) => ({
          "@type": "LocalBusiness",
          name: `${SITE_NAME} markt ${location.name}`,
          address: {
            "@type": "PostalAddress",
            addressLocality: location.city,
            addressCountry: location.city === "Antwerpen" ? "BE" : "NL",
          },
          openingHoursSpecification: location.days.map((day) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day],
          })),
        })),
      },
    ],
  };
}
