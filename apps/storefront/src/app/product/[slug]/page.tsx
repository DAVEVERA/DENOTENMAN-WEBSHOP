import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Leaf, ShoppingBag } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ProductConfigurator } from "@/components/product/ProductConfigurator";
import { ProductUspBox } from "@/components/product/ProductUspBox";

interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  description?: string;
  organic: boolean;
  tasteNotes?: string;
  origin?: string;
  ingredients?: string;
  storageInfo?: string;
  allergens?: string[];
  category: { slug: string; name: string };
  images: { url: string; altText: string }[];
  variants: {
    id: string;
    name: string;
    priceCents: number;
    weightGrams: number;
    stockQuantity: number;
  }[];
}

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const p = await apiFetch<ProductDetail>(`/products/${params.slug}`);
    return {
      title: `${p.name} online bestellen | DeNotenman`,
      description:
        p.description ??
        `Bestel ${p.name} online. Vers gebrand en verpakt door DeNotenman. Snelle levering en de beste kwaliteit.`,
    };
  } catch {
    return { title: "Product" };
  }
}

export const revalidate = 60;

export default async function ProductPage({ params }: Props) {
  let product: ProductDetail;
  try {
    product = await apiFetch<ProductDetail>(`/products/${params.slug}`);
  } catch {
    notFound();
  }

  const img = product.images[0];

  return (
    <div className="bg-surface min-h-screen pb-24">
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "Product",
            name: product.name,
            image: img ? [img.url] : [],
            description: product.description,
            sku: product.sku,
            brand: {
              "@type": "Brand",
              name: "DeNotenman",
            },
            offers: product.variants.map((v) => ({
              "@type": "Offer",
              url: `https://denotenman.com/product/${params.slug}`,
              priceCurrency: "EUR",
              price: (v.priceCents / 100).toFixed(2),
              availability:
                v.stockQuantity > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              itemCondition: "https://schema.org/NewCondition",
            })),
          }),
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Kruimelpad" className="mb-8">
          <ol className="flex items-center gap-2 text-sm text-neutral-500">
            <li>
              <Link href="/" className="hover:text-brand-green transition-colors">
                Home
              </Link>
            </li>
            <ChevronRight className="w-4 h-4" />
            <li>
              <Link
                href={`/categorie/${product.category.slug}`}
                className="hover:text-brand-green transition-colors"
              >
                {product.category.name}
              </Link>
            </li>
            <ChevronRight className="w-4 h-4" />
            <li
              className="font-medium text-neutral-900 truncate max-w-[200px] md:max-w-none"
              aria-current="page"
            >
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Top Product Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          {/* Left Column: Images (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="aspect-square overflow-hidden rounded-2xl bg-white border border-neutral-100 shadow-sm relative group">
              {img ? (
                <img
                  src={img.url}
                  alt={img.altText}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-300">
                  <ShoppingBag className="w-16 h-16 mb-4" />
                  <span className="text-sm">Geen afbeelding</span>
                </div>
              )}
            </div>
            {/* Thumbnails (Mocked for now since DB only returns 1 image usually) */}
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-white border border-neutral-100 overflow-hidden cursor-pointer hover:border-brand-green transition-colors opacity-70 hover:opacity-100"
                >
                  {img && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
          </div>

          {/* Middle Column: Details & Buy (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="mb-6">
              <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 tracking-tight leading-tight mb-3">
                {product.name}
              </h1>

              {product.organic && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green-50 px-3 py-1 text-xs font-semibold text-brand-green-700 mb-4 border border-brand-green-100">
                  <Leaf className="w-3.5 h-3.5" /> Biologisch
                </span>
              )}

              {product.description && (
                <p className="text-neutral-600 leading-relaxed">{product.description}</p>
              )}
            </div>

            <ProductConfigurator variants={product.variants} />
          </div>

          {/* Right Column: USPs (3 cols) */}
          <div className="lg:col-span-3">
            <ProductUspBox />
          </div>
        </div>

        {/* Product Details Section (Tabs/Grid) */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
          {/* Omschrijving */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-8 lg:p-10 border border-neutral-100 shadow-sm">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6 font-serif">Omschrijving</h2>
            <div className="prose prose-neutral max-w-none text-neutral-600">
              <h3 className="text-lg font-bold text-neutral-900 mb-2">{product.name}</h3>
              <p className="mb-4">{product.description}</p>

              {product.tasteNotes && (
                <>
                  <p className="font-semibold text-neutral-900 mt-6 mb-1">Smaakprofiel</p>
                  <p>{product.tasteNotes}</p>
                </>
              )}

              <p className="mt-6">
                Ideaal om zo te eten, door je ontbijt te mengen of om te gebruiken in baksels en
                salades. Onze noten zijn vers gebrand of gewoon 100% puur natuur.
              </p>
              <p className="mt-4 font-medium text-brand-green-700">
                Voor wie houdt van pure eenvoud en rijke smaak.
              </p>
            </div>
          </div>

          {/* Specs & Extra Info */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="bg-white rounded-3xl p-8 lg:p-10 border border-neutral-100 shadow-sm">
              <h2 className="text-xl font-bold text-neutral-900 mb-6">Voedingswaarden</h2>
              <div className="divide-y divide-neutral-100 text-sm">
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Energie (kJ)</span>
                  <span className="font-medium text-neutral-900">2986</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Energie (kcal)</span>
                  <span className="font-medium text-neutral-900">728</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Vetten</span>
                  <span className="font-medium text-neutral-900">72.0 g/100g</span>
                </div>
                <div className="py-3 flex justify-between pl-4">
                  <span className="text-neutral-500">- Verzadigd</span>
                  <span className="font-medium text-neutral-900">6.0 g/100g</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Eiwitten</span>
                  <span className="font-medium text-neutral-900">9.2 g/100g</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Koolhydraten</span>
                  <span className="font-medium text-neutral-900">5.8 g/100g</span>
                </div>
                <div className="py-3 flex justify-between pl-4">
                  <span className="text-neutral-500">- Suikers</span>
                  <span className="font-medium text-neutral-900">4.3 g/100g</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Voedingsvezels</span>
                  <span className="font-medium text-neutral-900">4.7 g/100g</span>
                </div>
                <div className="py-3 flex justify-between border-b-0">
                  <span className="text-neutral-500">Zout</span>
                  <span className="font-medium text-neutral-900">0 g/100g</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 lg:p-10 border border-neutral-100 shadow-sm">
              <h2 className="text-xl font-bold text-neutral-900 mb-6">Extra informatie</h2>
              <div className="divide-y divide-neutral-100 text-sm">
                <div className="py-3 flex">
                  <span className="text-neutral-500 w-1/3 shrink-0">SKU</span>
                  <span className="font-medium text-neutral-900">{product.sku}</span>
                </div>
                <div className="py-3 flex">
                  <span className="text-neutral-500 w-1/3 shrink-0">Merk</span>
                  <span className="font-medium text-brand-green-700">DeNotenman</span>
                </div>
                {product.origin && (
                  <div className="py-3 flex">
                    <span className="text-neutral-500 w-1/3 shrink-0">Herkomst</span>
                    <span className="font-medium text-neutral-900">{product.origin}</span>
                  </div>
                )}
                {product.allergens && product.allergens.length > 0 && (
                  <div className="py-3 flex">
                    <span className="text-neutral-500 w-1/3 shrink-0">Allergenen</span>
                    <span className="font-medium text-neutral-900 leading-snug">
                      Kan sporen bevatten van: gluten, pinda, amandel, hazelnoot, walnoot,
                      cashewnoot, pecannoot, paranoot, pistachenoot en macadamianoot.
                      <br />
                      <br />
                      <strong className="font-bold">Bevat:</strong> {product.allergens.join(", ")}
                    </span>
                  </div>
                )}
                {product.storageInfo && (
                  <div className="py-3 flex border-b-0">
                    <span className="text-neutral-500 w-1/3 shrink-0">Bewaaradvies</span>
                    <span className="font-medium text-neutral-900">{product.storageInfo}</span>
                  </div>
                )}
                {!product.storageInfo && (
                  <div className="py-3 flex border-b-0">
                    <span className="text-neutral-500 w-1/3 shrink-0">Bewaaradvies</span>
                    <span className="font-medium text-neutral-900">
                      Koel, droog en donker bewaren.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended products mockup */}
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 font-serif">
            Aanbevolen voor jou
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="group flex flex-col items-center bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-32 h-32 rounded-full bg-brand-green-50 overflow-hidden mb-6 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full flex items-center justify-center text-brand-green-200">
                    <Leaf className="w-12 h-12" />
                  </div>
                </div>
                <h3 className="font-bold text-neutral-900 text-center mb-1">Amandelen Gebrand</h3>
                <p className="text-xs text-neutral-500 mb-4">DeNotenman</p>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="text-sm font-medium text-neutral-900">
                    Vanaf <strong>€4,95</strong>
                  </span>
                  <div className="w-8 h-8 rounded-full border border-brand-green flex items-center justify-center text-brand-green group-hover:bg-brand-green group-hover:text-white transition-colors">
                    <span className="text-lg leading-none">+</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
