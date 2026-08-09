import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { product as productPath } from "@/lib/routes";
import { getProductBySlug, getProductSlugs } from "@/lib/queries";

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const entries = await getProductSlugs(locale);
      return entries.map((entry) => ({ locale, product: entry.slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const locale = rawLocale;
  const data = await getProductBySlug(product, locale);

  if (!data) {
    return {};
  }

  return {
    alternates: {
      canonical: productPath(locale, data.slug),
      languages: Object.fromEntries(
        locales.flatMap((loc) => {
          const slug = data.slugsByLocale[loc];
          return slug ? [[loc, productPath(loc, slug)] as const] : [];
        })
      ),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
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
