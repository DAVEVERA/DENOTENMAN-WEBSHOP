import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import type { ProductDetailDto } from "@/lib/queries";
import { ShoppingCart } from "lucide-react";
import { productActionButtonClass } from "@/lib/product-action-button";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { Tabs } from "@/components/ui/Tabs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantSelector } from "@/components/product/VariantSelector";
import { BackInStockForm } from "@/components/product/BackInStockForm";
import { ProductRecommendations } from "@/components/product/ProductRecommendations";
import { ProductPromotionCallout } from "@/components/product/ProductPromotionCallout";
import { category as categoryPath, home } from "@/lib/routes";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import { resolveProductDescription } from "@/lib/product-description";
import { ProductFaqAccordion } from "@/components/product/ProductFaqAccordion";
import { ProductViewTracker } from "@/components/product/ProductViewTracker";

const dictionaries = { nl, en, fr };
const homeLabels = { nl: "Home", en: "Home", fr: "Accueil" } as const;
const breadcrumbLabels = {
  nl: "Broodkruimel",
  en: "Breadcrumb",
  fr: "Fil d'Ariane",
} as const;

const nutritionRows: { key: string; dictKey: keyof (typeof nl)["product"] }[] = [
  { key: "nutrition.fat", dictKey: "nutritionFat" },
  { key: "nutrition.saturatedFat", dictKey: "nutritionSaturatedFat" },
  { key: "nutrition.carbohydrates", dictKey: "nutritionCarbohydrates" },
  { key: "nutrition.sugars", dictKey: "nutritionSugars" },
  { key: "nutrition.fiber", dictKey: "nutritionFiber" },
  { key: "nutrition.protein", dictKey: "nutritionProtein" },
  { key: "nutrition.salt", dictKey: "nutritionSalt" },
];

const productFactRows: { key: string; dictKey: keyof (typeof nl)["product"] }[] = [
  { key: "origin", dictKey: "origin" },
  { key: "taste", dictKey: "taste" },
  { key: "usage", dictKey: "usage" },
  { key: "storage", dictKey: "storage" },
];

export function formatNutritionMeasurement(value: string): string {
  return `${value} g`;
}

export function ProductDetailContent({
  data,
  locale,
  initialVariantSku,
}: {
  data: ProductDetailDto;
  locale: Locale;
  initialVariantSku?: string;
}) {
  const dictionary = dictionaries[locale];
  const faqs = data.faqs ?? {
    BELOW_DESCRIPTION: [],
    BELOW_PRODUCT_DETAILS: [],
    BEFORE_REVIEWS: [],
    PAGE_BOTTOM: [],
  };
  const attributes = new Map(data.attributes.map((attribute) => [attribute.key, attribute.value]));
  const primaryImage = data.images.find((image) => image.isPrimary) ?? data.images[0];
  const energyKj = attributes.get("nutrition.energyKj");
  const energyKcal = attributes.get("nutrition.energyKcal");
  const resolvedDescription = resolveProductDescription(data, locale);

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
        value: formatNutritionMeasurement(attributes.get(row.key) as string),
      })),
  ];

  const ingredients = attributes.get("ingredients");
  const allergens = attributes.get("allergens");
  const mayContainTraces = attributes.get("mayContainTraces");
  const productFacts = productFactRows.flatMap(({ key, dictKey }) => {
    const value = attributes.get(key)?.trim();
    return value ? [{ label: dictionary.product[dictKey], value }] : [];
  });

  return (
    <div className="grid grid-cols-1 gap-7 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-9 lg:p-8">
      <ProductViewTracker productId={data.id} />
      <nav
        aria-label={breadcrumbLabels[locale]}
        className="-mb-3 min-w-0 text-body-sm text-muted lg:col-span-2"
      >
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={home(locale)}>
              {homeLabels[locale]}
            </Link>
          </li>
          {data.category ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                  href={categoryPath(locale, data.category.slug)}
                >
                  {data.category.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="min-w-0 truncate text-text" aria-current="page">
            {data.name}
          </li>
        </ol>
      </nav>
      <ProductGallery images={data.images} productName={data.name} />

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-heading text-text sm:text-3xl">
              {data.name}
            </h1>
            {!data.isActive ? (
              <span className="mt-2 inline-flex rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                {dictionary.product.outOfStock}
              </span>
            ) : null}
          </div>
          <FavoriteButton
            className="h-11 w-11 shrink-0"
            label={{
              on: dictionary.product.removeFromFavorites,
              off: dictionary.product.addToFavorites,
            }}
          />
        </div>

        {data.shortDescriptionHtml ? (
          <div
            className="product-rich-text product-short-description mt-3 max-w-2xl text-body-md"
            dangerouslySetInnerHTML={{ __html: data.shortDescriptionHtml }}
          />
        ) : data.shortDescription ? (
          <p className="mt-3 max-w-2xl text-body-md leading-relaxed text-text">{data.shortDescription}</p>
        ) : null}

        {productFacts.length > 0 ? (
          <dl className="mt-5 grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2">
            {productFacts.map((fact) => (
              <div key={fact.label}>
                <dt className="font-heading text-body-sm font-bold text-text">{fact.label}</dt>
                <dd className="mt-1 text-body-sm leading-relaxed text-muted">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {data.promotionText ? <ProductPromotionCallout text={data.promotionText} /> : null}

        {data.variants.length > 0 ? (
          <div className="mt-5">
            <VariantSelector
              variants={data.variants}
              locale={locale}
              unit={data.unit}
              isActive={data.isActive}
              initialVariantSku={initialVariantSku}
              product={{
                id: data.id,
                slug: data.slug,
                name: data.name,
                imageUrl: primaryImage?.url ?? null,
              }}
            />
          </div>
        ) : (
          <div className="mt-5">
            <button
              type="button"
              disabled
              className={`${productActionButtonClass} h-12 w-full opacity-60`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {dictionary.product.order}
            </button>
            <p className="mt-2 text-center text-body-sm font-semibold text-red-700">
              {dictionary.product.outOfStock}
            </p>
          </div>
        )}

        {!data.isActive ? <BackInStockForm productId={data.id} locale={locale} /> : null}

        <div className="mt-8">
          <Tabs
            tabs={[
              {
                id: "description",
                label: dictionary.product.tabDescription,
                content: data.descriptionHtml ? (
                  <>
                    <div
                      className="product-rich-text"
                      dangerouslySetInnerHTML={{ __html: data.descriptionHtml }}
                    />
                    <ProductFaqAccordion items={faqs.BELOW_DESCRIPTION} locale={locale} placement="BELOW_DESCRIPTION" />
                  </>
                ) : (
                  <>
                    <p className="text-text">{data.description ?? resolvedDescription}</p>
                    <ProductFaqAccordion items={faqs.BELOW_DESCRIPTION} locale={locale} placement="BELOW_DESCRIPTION" />
                  </>
                ),
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
            ]}
          />
        </div>
        <ProductFaqAccordion items={faqs.BELOW_PRODUCT_DETAILS} locale={locale} placement="BELOW_PRODUCT_DETAILS" />
      </div>
      <ProductFaqAccordion items={faqs.BEFORE_REVIEWS} locale={locale} placement="BEFORE_REVIEWS" />
      <ProductRecommendations items={data.recommendations} locale={locale} />
      <ProductFaqAccordion items={faqs.PAGE_BOTTOM} locale={locale} placement="PAGE_BOTTOM" />
    </div>
  );
}
