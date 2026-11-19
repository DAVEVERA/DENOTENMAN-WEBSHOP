import type { Metadata } from "next";
import type { AlternatesResult } from "@/lib/alternates";
import type { Locale } from "@/lib/i18n";
import { BASE_URL } from "@/lib/routes";

export const BRAND_NAME = "De Notenman";

/**
 * 1200x630 is the ratio WhatsApp and LinkedIn promote to a large card; go
 * narrower and they fall back to a small thumbnail next to the text.
 */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** og:locale wants a Facebook-style locale, not our bare two-letter code. */
const openGraphLocales: Record<Locale, string> = {
  nl: "nl_NL",
  en: "en_GB",
  fr: "fr_FR",
};

export type SeoImage = {
  /** Root-relative or absolute; always emitted absolute. */
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

/**
 * Most scrapers ignore a relative og:image, so every URL we hand them is
 * resolved against the configured site origin before it reaches the tag.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, `${BASE_URL.replace(/\/$/, "")}/`).toString();
}

/**
 * The single place that turns page facts into tags: title, description,
 * canonical + hreflang, Open Graph and Twitter. Every generateMetadata()
 * goes through here so a page can never again ship with half a card.
 *
 * Note that Next merges `openGraph` *shallowly* between segments, so a page
 * that sets any openGraph field replaces the whole object from its layout.
 * That is why this helper always emits a complete one.
 */
export function buildMetadata({
  title,
  description,
  locale,
  alternates,
  image,
  type = "website",
  noIndex = false,
  robots,
}: {
  title: string;
  description?: string;
  locale: Locale;
  alternates?: AlternatesResult;
  /** Omit to fall back to the segment's generated brand card. */
  image?: SeoImage;
  type?: "website" | "article";
  noIndex?: boolean;
  /** Full directive for pages with their own policy; wins over `noIndex`. */
  robots?: Metadata["robots"];
}): Metadata {
  const canonical = alternates?.canonical;

  return {
    title,
    ...(description ? { description } : {}),
    ...(robots
      ? { robots }
      : noIndex
        ? { robots: { index: false, follow: true } }
        : {}),
    ...(alternates
      ? { alternates: { canonical: alternates.canonical, languages: alternates.languages } }
      : {}),
    openGraph: {
      type,
      title,
      ...(description ? { description } : {}),
      siteName: BRAND_NAME,
      locale: openGraphLocales[locale],
      ...(canonical ? { url: absoluteUrl(canonical) } : {}),
      // Left undefined on purpose when there is no page-specific photo: the
      // opengraph-image route for this segment then supplies the brand card.
      ...(image
        ? {
            images: [
              {
                url: absoluteUrl(image.url),
                width: image.width ?? OG_IMAGE_SIZE.width,
                height: image.height ?? OG_IMAGE_SIZE.height,
                alt: image.alt,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
      ...(image ? { images: [{ url: absoluteUrl(image.url), alt: image.alt }] } : {}),
    },
  };
}
