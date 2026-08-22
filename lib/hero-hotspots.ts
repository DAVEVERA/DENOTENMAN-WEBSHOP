export type HeroLabelDefinition = {
  id: string;
  sku: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HeroProductHotspot = Omit<HeroLabelDefinition, "sku"> & {
  href: string;
  productName: string;
};

export const HERO_LABELS: readonly HeroLabelDefinition[] = [
  { id: "linde-small", sku: "NAT-10014-350-P", x: 8.6, y: 60.8, width: 3.9, height: 7.3 },
  { id: "tijm", sku: "NAT-10018-350-P", x: 14, y: 60.2, width: 3.9, height: 7.3 },
  { id: "linde-tall", sku: "NAT-10014-350-P", x: 21.2, y: 52, width: 4, height: 8.9 },
  { id: "acacia-tall", sku: "NAT-10003-350-P", x: 29.1, y: 50.1, width: 4.7, height: 9.1 },
  { id: "berg", sku: "NAT-10006-350-P", x: 37.2, y: 52.2, width: 3.9, height: 8.9 },
  { id: "zonnebloem", sku: "NAT-10021-350-P", x: 44.9, y: 58.4, width: 5.3, height: 10 },
  { id: "heide", sku: "NAT-10011-350-P", x: 33.1, y: 62.6, width: 4, height: 8.1 },
  { id: "woud", sku: "NAT-10019-350-P", x: 22.6, y: 70.3, width: 4, height: 7.8 },
  { id: "bloemen", sku: "NAT-10010-900-P", x: 8.5, y: 76.4, width: 4.3, height: 7.7 },
  { id: "acacia-small", sku: "NAT-10003-350-P", x: 15.4, y: 76.3, width: 4.1, height: 7.6 },
  { id: "amandelen-middle", sku: "NOT-1010-250-P", x: 54.5, y: 57, width: 4.1, height: 6.6 },
  { id: "macadamia", sku: "NOT-1023-200-P", x: 59.2, y: 65.2, width: 4.2, height: 7 },
  { id: "amandelen-tall", sku: "NOT-1010-250-P", x: 63, y: 54.6, width: 4.5, height: 6.9 },
  { id: "walnoten", sku: "NOT-1008-200-P", x: 70.6, y: 51.6, width: 4.7, height: 7.2 },
  { id: "cashew", sku: "NOT-1015-250-P", x: 77.7, y: 49.3, width: 4.5, height: 8.1 },
  { id: "para", sku: "NOT-1001-250-P", x: 85.5, y: 49.8, width: 4.3, height: 8.5 },
  { id: "notenmix-tall", sku: "MIX-3003-250-P", x: 92.3, y: 59.2, width: 5, height: 8.9 },
  { id: "pecan", sku: "NOT-1003-200-P", x: 69.9, y: 67.3, width: 4.7, height: 7.6 },
  { id: "hazel", sku: "NOT-1018-250-P", x: 77.5, y: 68.9, width: 4.8, height: 7.2 },
  { id: "pistaches", sku: "NOT-1006-100-P", x: 85.3, y: 73.1, width: 5.1, height: 8.5 },
  { id: "notenmix-front", sku: "MIX-3003-250-P", x: 93.4, y: 73.9, width: 5, height: 8.5 },
] as const;

export type OfferedHeroProduct = {
  sku: string;
  name: string;
  slug: string;
};

export function resolveHeroProductHotspots(
  products: readonly OfferedHeroProduct[],
  hrefForSlug: (slug: string) => string,
): HeroProductHotspot[] {
  const productsBySku = new Map(products.map((item) => [item.sku, item]));

  return HERO_LABELS.flatMap((label) => {
    const matchingProduct = productsBySku.get(label.sku);

    if (!matchingProduct) {
      return [];
    }

    const { sku: _sku, ...position } = label;

    return [
      {
        ...position,
        href: hrefForSlug(matchingProduct.slug),
        productName: matchingProduct.name,
      },
    ];
  });
}
