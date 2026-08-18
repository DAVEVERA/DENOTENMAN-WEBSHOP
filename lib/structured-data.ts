import type { Locale } from "@/lib/i18n";
import type {
  ProductDetailDto,
  ProductSummaryDto,
  ProductVariantDto,
} from "@/lib/queries";
import { category, home, product as productPath } from "@/lib/routes";
import { toProductPlainText } from "@/lib/product-content";

const SCHEMA = "https://schema.org";
const BRAND_NAME = "De Notenman";

const homeLabels: Record<Locale, string> = {
  nl: "Home",
  en: "Home",
  fr: "Accueil",
};

function absoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

function organizationEntity(baseUrl: string) {
  const origin = baseUrl.replace(/\/$/, "");
  return {
    "@type": "Organization",
    "@id": `${origin}#organization`,
    name: BRAND_NAME,
    url: origin,
    logo: absoluteUrl(baseUrl, "/brand/logo-wordmark.svg"),
  };
}

export function buildOrganizationStructuredData(baseUrl: string) {
  return { "@context": SCHEMA, ...organizationEntity(baseUrl) };
}

export function buildBreadcrumbStructuredData(
  baseUrl: string,
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(baseUrl, item.path),
    })),
  };
}

export function variantSelectionUrl(
  baseUrl: string,
  locale: Locale,
  slug: string,
  sku: string
): string {
  const url = new URL(productPath(locale, slug), `${baseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("variant", sku);
  return url.toString();
}

export function isStorefrontVariantOrderable(
  productIsActive: boolean,
  variant: Pick<ProductVariantDto, "stock">
): boolean {
  return productIsActive && variant.stock > 0;
}

function schemaAvailability(orderable: boolean): string {
  return `${SCHEMA}/${orderable ? "InStock" : "OutOfStock"}`;
}

function merchantAvailability(orderable: boolean): "in_stock" | "out_of_stock" {
  return orderable ? "in_stock" : "out_of_stock";
}

function variantLabel(
  variant: ProductVariantDto,
  unit: ProductSummaryDto["unit"]
): string {
  return variant.label ?? `${variant.weightGrams} ${unit === "VOLUME" ? "ml" : "g"}`;
}

function productVariantEntity(input: {
  product: ProductDetailDto;
  variant: ProductVariantDto;
  locale: Locale;
  baseUrl: string;
  imageUrl?: string;
}) {
  const { product, variant, locale, baseUrl, imageUrl } = input;
  const label = variantLabel(variant, product.unit);
  const selectionUrl = variantSelectionUrl(baseUrl, locale, product.slug, variant.sku);

  return {
    "@type": "Product",
    "@id": `${selectionUrl}#product`,
    url: selectionUrl,
    name: `${product.name} - ${label}`,
    description: product.shortDescription ?? product.description ?? undefined,
    sku: variant.sku,
    image: imageUrl ? [imageUrl] : undefined,
    size: label,
    brand: { "@type": "Brand", name: BRAND_NAME },
    offers: {
      "@type": "Offer",
      url: selectionUrl,
      priceCurrency: product.currency,
      price: (variant.priceCents / 100).toFixed(2),
      availability: schemaAvailability(
        isStorefrontVariantOrderable(product.isActive, variant)
      ),
      itemCondition: `${SCHEMA}/NewCondition`,
    },
  };
}

export function buildProductStructuredData(input: {
  product: ProductDetailDto;
  locale: Locale;
  baseUrl: string;
}) {
  const { product, locale, baseUrl } = input;
  const pageUrl = absoluteUrl(baseUrl, productPath(locale, product.slug));
  const primaryImage =
    product.images.find((image) => image.isPrimary) ?? product.images[0];
  const variants = [...product.variants].sort(
    (left, right) => left.weightGrams - right.weightGrams
  );
  const variantEntities = variants.map((variant) =>
    productVariantEntity({
      product,
      variant,
      locale,
      baseUrl,
      imageUrl: primaryImage?.url,
    })
  );
  const productEntity =
    variantEntities.length > 1
      ? {
          "@type": "ProductGroup",
          "@id": `${pageUrl}#product-group`,
          url: pageUrl,
          name: product.name,
          description: product.shortDescription ?? product.description ?? undefined,
          productGroupID: product.sku,
          image: primaryImage ? [primaryImage.url] : undefined,
          brand: { "@type": "Brand", name: BRAND_NAME },
          variesBy: [`${SCHEMA}/size`],
          hasVariant: variantEntities,
        }
      : (variantEntities[0] ?? {
          "@type": "Product",
          "@id": `${pageUrl}#product`,
          url: pageUrl,
          name: product.name,
          description: product.shortDescription ?? product.description ?? undefined,
          sku: product.sku,
          image: primaryImage ? [primaryImage.url] : undefined,
          brand: { "@type": "Brand", name: BRAND_NAME },
          offers: {
            "@type": "Offer",
            url: pageUrl,
            priceCurrency: product.currency,
            price: (product.basePriceCents / 100).toFixed(2),
            availability: schemaAvailability(false),
            itemCondition: `${SCHEMA}/NewCondition`,
          },
        });
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabels[locale],
      item: absoluteUrl(baseUrl, home(locale)),
    },
    ...(product.category
      ? [
          {
            "@type": "ListItem",
            position: 2,
            name: product.category.name,
            item: absoluteUrl(baseUrl, category(locale, product.category.slug)),
          },
        ]
      : []),
    {
      "@type": "ListItem",
      position: product.category ? 3 : 2,
      name: product.name,
      item: pageUrl,
    },
  ];

  return {
    "@context": SCHEMA,
    "@graph": [
      organizationEntity(baseUrl),
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
      productEntity,
    ],
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildGoogleMerchantFeedXml(input: {
  products: ProductSummaryDto[];
  locale: Locale;
  baseUrl: string;
}): string {
  const { products, locale, baseUrl } = input;
  const items = products.flatMap((product) => {
    const primaryImage =
      product.images.find((image) => image.isPrimary) ?? product.images[0];
    if (!primaryImage) return [];

    const description =
      toProductPlainText(product.shortDescription ?? product.description) || product.name;

    return product.variants.map((variant) => {
      const label = variantLabel(variant, product.unit);
      const link = variantSelectionUrl(baseUrl, locale, product.slug, variant.sku);
      const title = `${product.name} - ${label}`;

      return [
        "<item>",
        `<g:id>${escapeXml(variant.sku)}</g:id>`,
        `<g:item_group_id>${escapeXml(product.sku)}</g:item_group_id>`,
        `<title>${escapeXml(title)}</title>`,
        `<description>${escapeXml(description)}</description>`,
        `<link>${escapeXml(link)}</link>`,
        `<g:image_link>${escapeXml(primaryImage.url)}</g:image_link>`,
        `<g:price>${(variant.priceCents / 100).toFixed(2)} ${escapeXml(product.currency)}</g:price>`,
        `<g:availability>${merchantAvailability(
          isStorefrontVariantOrderable(product.isActive, variant)
        )}</g:availability>`,
        "<g:condition>new</g:condition>",
        `<g:brand>${BRAND_NAME}</g:brand>`,
        "<g:identifier_exists>no</g:identifier_exists>",
        `<g:size>${escapeXml(label)}</g:size>`,
        "</item>",
      ].join("");
    });
  });

  const channelUrl = baseUrl.replace(/\/$/, "");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    "<channel>",
    `<title>${BRAND_NAME}</title>`,
    `<link>${escapeXml(channelUrl)}</link>`,
    `<description>${BRAND_NAME} productfeed</description>`,
    ...items,
    "</channel>",
    "</rss>",
  ].join("\n");
}
