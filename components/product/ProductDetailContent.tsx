import type { Locale } from "@/lib/i18n";
import type { ProductDetailDto } from "@/lib/queries";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { Tabs } from "@/components/ui/Tabs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantSelector } from "@/components/product/VariantSelector";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

const nutritionRows: { key: string; dictKey: keyof (typeof nl)["product"] }[] = [
  { key: "nutrition.fat", dictKey: "nutritionFat" },
  { key: "nutrition.saturatedFat", dictKey: "nutritionSaturatedFat" },
  { key: "nutrition.carbohydrates", dictKey: "nutritionCarbohydrates" },
  { key: "nutrition.sugars", dictKey: "nutritionSugars" },
  { key: "nutrition.fiber", dictKey: "nutritionFiber" },
  { key: "nutrition.protein", dictKey: "nutritionProtein" },
  { key: "nutrition.salt", dictKey: "nutritionSalt" },
];

export function ProductDetailContent({
  data,
  locale,
}: {
  data: ProductDetailDto;
  locale: Locale;
}) {
  const dictionary = dictionaries[locale];
  const attributes = new Map(data.attributes.map((attribute) => [attribute.key, attribute.value]));
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
    <div className="grid grid-cols-1 gap-7 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-9 lg:p-8">
      <ProductGallery images={data.images} productName={data.name} />

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-heading text-2xl font-bold tracking-heading text-text sm:text-3xl">
            {data.name}
          </h1>
          <FavoriteButton
            label={{
              on: dictionary.product.removeFromFavorites,
              off: dictionary.product.addToFavorites,
            }}
          />
        </div>

        {data.shortDescription ? (
          <p className="mt-3 max-w-2xl text-body-md leading-relaxed text-text">
            {data.shortDescription}
          </p>
        ) : null}

        {data.variants.length > 0 ? (
          <div className="mt-5">
            <VariantSelector
              variants={data.variants}
              locale={locale}
              unit={data.unit}
              product={{
                id: data.id,
                slug: data.slug,
                name: data.name,
                imageUrl: primaryImage?.url ?? null,
              }}
            />
          </div>
        ) : null}

        <div className="mt-8">
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
                    <p className="text-body-sm text-muted">
                      {data.unit === "VOLUME"
                        ? dictionary.product.perHundredMilliliters
                        : dictionary.product.perHundredGrams}
                    </p>
                    {nutritionEntries.length > 0 ? (
                      <dl className="mt-3 divide-y divide-border">
                        {nutritionEntries.map((entry) => (
                          <div key={entry.label} className="flex items-center justify-between py-2">
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
  );
}
