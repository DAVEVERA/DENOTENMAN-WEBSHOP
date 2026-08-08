import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";
import { product as productPath } from "@/lib/routes";
import { getProductBySlug, getProductSlugs } from "@/lib/queries";

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const slugs = await getProductSlugs(locale);
      return slugs.map((slug) => ({ locale, product: slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; product: string }>;
}): Promise<Metadata> {
  const { locale, product } = await params;
  const data = await getProductBySlug(product, locale);

  if (!data) {
    return {};
  }

  return {
    alternates: {
      canonical: productPath(locale, data.slug),
      languages: Object.fromEntries(
        Object.entries(data.slugsByLocale).map(([loc, slug]) => [
          loc,
          productPath(loc as Locale, slug),
        ])
      ),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; product: string }>;
}) {
  const { locale, product } = await params;
  const data = await getProductBySlug(product, locale);

  if (!data) {
    notFound();
  }

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.description}</p>
    </div>
  );
}
