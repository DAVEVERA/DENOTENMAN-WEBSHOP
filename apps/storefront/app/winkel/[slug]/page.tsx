import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGallery } from "../../../components/product/ProductGallery";
import { ProductInfo } from "../../../components/product/ProductInfo";
import { ProductPurchaseForm } from "../../../components/product/ProductPurchaseForm";
import { ProductTabs } from "../../../components/product/ProductTabs";
import { RelatedProducts } from "../../../components/product/RelatedProducts";
import {
  formatPrice,
  getProductBySlug,
  listProducts,
} from "../../../lib/products";
import {
  absoluteUrl,
  getAvailabilityUrl,
  getBreadcrumbJsonLd,
  getProductDescription,
  getProductPrice,
  serializeJsonLd,
  SITE_NAME,
} from "../../../lib/seo";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function cleanProductText(text?: string | null) {
  return text?.replace(/^\s*ingredienten?\s*:\s*/i, "").trim() || null;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {};
  }

  const price = getProductPrice(product);
  const description = getProductDescription(product);

  return {
    title: {
      absolute: `${product.name} kopen | ${SITE_NAME}`,
    },
    description,
    alternates: {
      canonical: `/winkel/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} kopen | ${SITE_NAME}`,
      description,
      images: product.image ? [product.image] : ["/Notenman_onlylogo.png"],
      url: `/winkel/${product.slug}`,
    },
    other: {
      "product:price:amount": String(price),
      "product:price:currency": "EUR",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = (await listProducts()).filter((item) => item.slug !== product.slug).slice(0, 8);
  const description = cleanProductText(product.description);
  const lowestWeightPrice = product.weights[0]?.price;
  const displayPrice = formatPrice(lowestWeightPrice ?? product.basePrice);
  const stockLabel = product.variants[0]?.stockLabel ?? "Op voorraad";
  const productUrl = absoluteUrl(`/winkel/${product.slug}`);
  const categoryUrl = absoluteUrl(`/categorie/${product.category}`);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image ? [absoluteUrl(product.image)] : [absoluteUrl("/Notenman_onlylogo.png")],
    description: description ?? getProductDescription(product),
    sku: product.variants[0]?.sku ?? product.variants[0]?.variantId ?? String(product.id),
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    category: product.categoryLabel,
    offers: {
      "@type": "Offer",
      availability: getAvailabilityUrl(stockLabel),
      price: String(lowestWeightPrice ?? product.basePrice),
      priceCurrency: "EUR",
      itemCondition: "https://schema.org/NewCondition",
      url: productUrl,
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "NL",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
      },
    },
  };
  const breadcrumbJsonLd = getBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Winkel", url: "/winkel" },
    { name: product.categoryLabel, url: categoryUrl },
    { name: product.name, url: productUrl },
  ]);

  return (
    <main className="business-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <section className="container product-detail-page">
        <ProductGallery image={product.image} name={product.name} />

        <div className="product-detail-content">
          <ProductInfo
            description={product.description}
            name={product.name}
            origin={product.origin}
            price={displayPrice}
            stockLabel={stockLabel}
          />

          <ul className="product-trust-list" aria-label="Waarom bestellen bij De Notenman">
            <li>Dagvers geselecteerd</li>
            <li>Veilig betalen</li>
            <li>Snel geleverd</li>
          </ul>

          <ProductPurchaseForm product={product} />
        </div>
      </section>

      <section className="container product-detail-support">
        <RelatedProducts products={relatedProducts} />
        <ProductTabs
          category={product.categoryLabel}
          description={product.description}
          name={product.name}
        />
      </section>
    </main>
  );
}
