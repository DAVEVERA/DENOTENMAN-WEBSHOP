import { defaultLocale, isLocale } from "@/lib/i18n";
import { OG_IMAGE_SIZE } from "@/lib/seo/metadata";
import { renderBrandCard } from "@/lib/seo/og";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

/**
 * The default share card for every page under /[locale] that has no photo of
 * its own. Deeper segments with their own opengraph-image override it.
 */
export const alt = "De Notenman — vers gebrande noten en gedroogde zuidvruchten";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  return renderBrandCard({
    title: dictionaries[locale].brand.baseline,
    claim: "denotenman.com",
  });
}
