import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import { getProductBySlug, getProductSlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { Tabs } from "@/components/ui/Tabs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantSelector } from "@/components/product/VariantSelector";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

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

  const [alternates, data] = await Promise.all([
    getAlternates(rawLocale, { type: "product", slug: product }),
    getProductBySlug(product, rawLocale),
  ]);

  if (!alternates || !data) {
    return {};
  }

  return {
    title: data.name,
    description: data.shortDescription ?? data.description ?? undefined,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

const nutritionRows: { key: string; dictKey: keyof (typeof nl)["product"] }[] = [
  { key: "nutrition.fat", dictKey: "nutritionFat" },
  { key: "nutrition.saturatedFat", dictKey: "nutritionSaturatedFat" },
  { key: "nutrition.carbohydrates", dictKey: "nutritionCarbohydrates" },
  { key: "nutrition.sugars", dictKey: "nutritionSugars" },
  { key: "nutrition.fiber", dictKey: "nutritionFiber" },
  { key: "nutrition.protein", dictKey: "nutritionProtein" },
  { key: "nutrition.salt", dictKey: "nutritionSalt" },
];

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const dictionary = dictionaries[locale];
  const data = await getProductBySlug(product, locale);

  if (!data) {
    notFound();
  }

  const attributes = new Map(data.attributes.map((attr) => [attr.key, attr.value]));
  const primaryImage = data.images.find((image) => image.isPrimary) ?? data.images[0];
  const energyKj = attributes.get("nutrition.energyKj");
  const energyKcal = attributes.get("nutrition.energyKcal");

  const nutritionEntries = [
    ...(energyKj || energyKcal
      ? [
          {
            label: dictionary.product.nutritionEnergy,
            value: [energyKj ? `${energyKj} kJ` : null, energyKcal ? `${energyKcal} kcal` : null]
              .filter(Boolean)
              .join(" / "),
          },
        ]
      : []),
    ...nutritionRows
      .filter((row) => attributes.has(row.key))
      .map((row) => ({
        label: dictionary.product[row.dictKey],
        value: attributes.get(row.key) as string,
      })),
  ];

  const ingredients = attributes.get("ingredients");
  const allergens = attributes.get("allergens");
  const mayContainTraces = attributes.get("mayContainTraces");

  const faq1Question = attributes.get("faq.1.question");
  const faq1Answer = attributes.get("faq.1.answer");
  const faq2Question = attributes.get("faq.2.question");
  const faq2Answer = attributes.get("faq.2.answer");
  const hasFaq = Boolean(faq1Question && faq1Answer) || Boolean(faq2Question && faq2Answer);

  return (
    <Container className="py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery images={data.images} productName={data.name} />

        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-3xl tracking-heading text-text">{data.name}</h1>
            <FavoriteButton
              label={{
                on: dictionary.product.removeFromFavorites,
                off: dictionary.product.addToFavorites,
              }}
            />
          </div>

          {data.shortDescription ? (
            <p className="mt-4 max-w-2xl text-body-md leading-relaxed text-text">
              {data.shortDescription}
            </p>
          ) : null}

          {data.variants.length > 0 ? (
            <div className="mt-6">
              <VariantSelector
                variants={data.variants}
                locale={locale}
                product={{
                  id: data.id,
                  slug: data.slug,
                  name: data.name,
                  imageUrl: primaryImage?.url ?? null,
                }}
              />
            </div>
          ) : null}

          <div className="mt-10">
            <Tabs
              tabs={[
                {
                  id: "description",
                  label: dictionary.product.tabDescription,
                  content: <p className="text-text">{data.description}</p>,
                },
                {
                  id: "nutrition",
                  label: dictionary.product.tabNutrition,
                  content: (
                    <div>
                      <p className="text-body-sm text-muted">{dictionary.product.perHundredGrams}</p>
                      {nutritionEntries.length > 0 ? (
                        <dl className="mt-3 divide-y divide-border">
                          {nutritionEntries.map((entry) => (
                            <div
                              key={entry.label}
                              className="flex items-center justify-between py-2"
                            >
                              <dt className="text-text">{entry.label}</dt>
                              <dd className="text-muted">{entry.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {ingredients ? (
                        <p className="mt-4 text-text">
                          <span className="font-heading">{dictionary.product.ingredients}: </span>
                          {ingredients}
                        </p>
                      ) : null}
                      {allergens ? (
                        <p className="mt-2 text-text">
                          <span className="font-heading">{dictionary.product.allergens}: </span>
                          {allergens}
                        </p>
                      ) : null}
                      {mayContainTraces ? (
                        <p className="mt-2 text-text">
                          <span className="font-heading">
                            {dictionary.product.mayContainTraces}:{" "}
                          </span>
                          {mayContainTraces}
                        </p>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: "faq",
                  label: dictionary.product.tabFaq,
                  content: hasFaq ? (
                    <dl className="space-y-4">
                      {faq1Question && faq1Answer ? (
                        <div>
                          <dt className="font-heading text-text">{faq1Question}</dt>
                          <dd className="mt-1 text-muted">{faq1Answer}</dd>
                        </div>
                      ) : null}
                      {faq2Question && faq2Answer ? (
                        <div>
                          <dt className="font-heading text-text">{faq2Question}</dt>
                          <dd className="mt-1 text-muted">{faq2Answer}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-muted">{dictionary.product.faqFallback}</p>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </Container>
  );
}
