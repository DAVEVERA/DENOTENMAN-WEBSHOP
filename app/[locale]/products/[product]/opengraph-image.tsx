import { defaultLocale, isLocale } from "@/lib/i18n";
import { getProductBySlug } from "@/lib/queries";
import { OG_IMAGE_SIZE } from "@/lib/seo/metadata";
import { renderProductCard } from "@/lib/seo/og";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

const FALLBACK_ALT = "De Notenman — vers gebrande noten en gedroogde zuidvruchten";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

type Params = { locale: string; product: string };

/**
 * `next build` collects page data for this route before any product exists:
 * /[locale] contributes static params, [product] is force-dynamic and
 * contributes none. The slug is therefore absent until a real request.
 */
type CollectedParams = { locale: string; product?: string };

async function load(params: CollectedParams | Promise<Params>) {
  const { locale: rawLocale, product } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const data = product ? await getProductBySlug(product, locale) : null;

  return { locale, data };
}

/**
 * Only here to give og:image:alt the product's own name — a single card,
 * not several sizes.
 */
export async function generateImageMetadata({
  params,
}: {
  params: CollectedParams;
}) {
  const { data } = await load(params);

  return [
    {
      id: "card",
      alt: data ? `${data.name} — De Notenman` : FALLBACK_ALT,
      size: OG_IMAGE_SIZE,
      contentType: "image/png",
    },
  ];
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale, data } = await load(params);
  const dictionary = dictionaries[locale];

  if (!data) {
    return renderProductCard({
      title: dictionary.brand.baseline,
      claim: "denotenman.com",
    });
  }

  // Prefer the pre-rendered square from the image pipeline; fall back to the
  // original upload, which is what live products currently have.
  const primary = data.images.find((image) => image.isPrimary) ?? data.images[0];

  return renderProductCard({
    title: data.name,
    claim: dictionary.brand.baseline,
    imageUrl: primary?.cardUrl ?? primary?.url,
  });
}
