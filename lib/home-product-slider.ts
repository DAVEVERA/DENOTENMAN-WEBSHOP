export type HomeSliderDefinition = {
  key: string;
  sku: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
};

export type HomeSliderVariantDto = {
  id: string;
  sku: string;
  label: string | null;
  weightGrams: number;
  priceCents: number;
  stock: number;
};

export type HomeSliderProductDto = HomeSliderDefinition & {
  id: string;
  slug: string;
  href: string;
  name: string;
  shortDescription: string | null;
  categoryName: string | null;
  priceCents: number;
  regularPriceCents: number;
  salePriceCents: number | null;
  hasVariablePrice: boolean;
  defaultVariant: HomeSliderVariantDto | null;
};

export type OfferedHomeSliderProduct = Omit<
  HomeSliderProductDto,
  keyof HomeSliderDefinition
> & { sku: string };

// This is the deliberate product contract for the user-supplied slider artwork.
// Identity is pinned to stable SKUs; filenames and localized slugs are never used
// to discover a similar product at runtime.
export const HOME_SLIDER_DEFINITIONS: readonly HomeSliderDefinition[] = [
  {
    key: "abrikozen",
    sku: "FRU-4018-250-P",
    imageSrc: "/product4slider/abrikozen.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "amandelen",
    sku: "NOT-1010-250-P",
    imageSrc: "/product4slider/amandelen.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "cashew",
    sku: "NOT-1015-250-P",
    imageSrc: "/product4slider/cashew.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "dadels",
    sku: "FRU-4028-500-P",
    imageSrc: "/product4slider/dadels.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "macadamia",
    sku: "NOT-1023-200-P",
    imageSrc: "/product4slider/macademia.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "notenmix",
    sku: "MIX-3003-250-P",
    imageSrc: "/product4slider/notenmix.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "pecan",
    sku: "NOT-1003-200-P",
    imageSrc: "/product4slider/pecan.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "pijnboompitten",
    sku: "PIT-7003-100-P",
    imageSrc: "/product4slider/pijnboompitten.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "pinda",
    sku: "PIN-2004-250-P",
    imageSrc: "/product4slider/pinda.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "pistache",
    sku: "NOT-1006-100-P",
    imageSrc: "/product4slider/pistache.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "sinaasappel",
    sku: "BAK-9010-200-P",
    imageSrc: "/product4slider/sinasappel.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
  {
    key: "walnoten",
    sku: "NOT-1008-200-P",
    imageSrc: "/product4slider/walnuts.png",
    imageWidth: 911,
    imageHeight: 911,
  },
  {
    key: "zonnebloempitten",
    sku: "PIT-7009-250-P",
    imageSrc: "/product4slider/zonnebloemzaad.png",
    imageWidth: 1024,
    imageHeight: 1024,
  },
] as const;

export function resolveHomeSliderProducts(
  products: readonly OfferedHomeSliderProduct[],
): HomeSliderProductDto[] {
  const bySku = new Map(products.map((product) => [product.sku, product]));

  return HOME_SLIDER_DEFINITIONS.flatMap((definition) => {
    const product = bySku.get(definition.sku);
    return product ? [{ ...definition, ...product }] : [];
  });
}

export function wrapHomeSliderIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return ((index % itemCount) + itemCount) % itemCount;
}
