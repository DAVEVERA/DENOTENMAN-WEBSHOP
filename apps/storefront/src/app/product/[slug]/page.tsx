import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Leaf, ShoppingBag, Info, Truck } from "lucide-react";
import { serverApiClient } from "@/lib/server-api";
import { ProductConfigurator } from "@/components/product/ProductConfigurator";
import { ProductUspBox } from "@/components/product/ProductUspBox";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const api = serverApiClient();
    const p = await api.products.getBySlug(params.slug);
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
  const api = serverApiClient();

  let product: Awaited<ReturnType<typeof api.products.getBySlug>>;
  try {
    product = await api.products.getBySlug(params.slug);
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

      {/* Decorative Header Background */}
      <div className="h-48 bg-brand-primary w-full absolute top-0 left-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(var(--brand-gold) 2px, transparent 2px)`,
            backgroundSize: "30px 30px",
          }}
        ></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-12 lg:pt-20">
        {/* Breadcrumb */}
        <nav
          aria-label="Kruimelpad"
          className="mb-10 backdrop-blur-md bg-white/50 w-fit px-4 py-2 rounded-full border border-brand-gold/30 shadow-sm"
        >
          <ol className="flex items-center gap-2 text-sm text-brand-primary/80 font-medium">
            <li>
              <Link href="/" className="hover:text-brand-gold transition-colors">
                Home
              </Link>
            </li>
            <ChevronRight className="w-4 h-4 text-brand-gold" />
            <li>
              <Link
                href={`/categorie/${product.category.slug}`}
                className="hover:text-brand-gold transition-colors"
              >
                {product.category.name}
              </Link>
            </li>
            <ChevronRight className="w-4 h-4 text-brand-gold" />
            <li
              className="text-brand-primary font-bold truncate max-w-[200px] md:max-w-none"
              aria-current="page"
            >
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Top Product Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-16 items-start">
          {/* Left Column: Image (5 cols) */}
          <div className="lg:col-span-5">
            <div className="aspect-[4/5] overflow-hidden rounded-[2rem] bg-white shadow-2xl relative group border-4 border-brand-gold/20">
              {img ? (
                <Image
                  src={img.url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-brand-primary/30 bg-surface">
                  <ShoppingBag className="w-20 h-20 mb-4 text-brand-gold" />
                  <span className="text-sm font-medium">Geen afbeelding beschikbaar</span>
                </div>
              )}
              {/* Premium overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Middle Column: Details & Buy (7 cols) */}
          <div className="lg:col-span-7 flex flex-col pt-4">
            <div className="mb-8">
              {product.organic && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-1.5 text-xs font-bold text-brand-gold mb-6 shadow-md uppercase tracking-wider">
                  <Leaf className="w-4 h-4" /> Biologisch
                </span>
              )}
              <h1 className="text-4xl lg:text-5xl font-bold text-brand-primary tracking-tight leading-tight mb-6 drop-shadow-sm">
                {product.name}
              </h1>

              {product.description && (
                <p className="text-brand-primary/80 leading-relaxed text-lg font-medium border-l-4 border-brand-highlight pl-4">
                  {product.description}
                </p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 border border-brand-gold/30 shadow-lg mb-8 relative overflow-hidden">
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/10 rounded-bl-full pointer-events-none"></div>
              <ProductConfigurator variants={product.variants} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface rounded-2xl p-5 border border-brand-primary/10 flex items-center gap-4">
                <div className="bg-brand-primary text-brand-gold p-3 rounded-xl">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-brand-primary">Gratis Verzending</h4>
                  <p className="text-sm text-brand-primary/70">Vanaf €40 in NL</p>
                </div>
              </div>
              <div className="bg-surface rounded-2xl p-5 border border-brand-primary/10 flex items-center gap-4">
                <div className="bg-brand-gold text-brand-primary p-3 rounded-xl">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-brand-primary">Direct Vers</h4>
                  <p className="text-sm text-brand-primary/70">Op bestelling verpakt</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Section (Tabs/Grid) */}
        <div className="mt-20 grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
          {/* Omschrijving */}
          <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 lg:p-12 border border-brand-gold/20 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-5">
              <Image
                src="/Logo/Denotenmascotte.png"
                width={200}
                height={200}
                alt="decoratief"
                className="object-contain"
              />
            </div>
            <h2 className="text-3xl font-bold text-brand-primary mb-8 border-b-2 border-brand-highlight/50 pb-4 inline-block">
              Productinformatie
            </h2>
            <div className="prose prose-lg prose-brand max-w-none text-brand-primary/80">
              <p className="mb-6 leading-relaxed">{product.description}</p>

              {product.tasteNotes && (
                <div className="bg-surface p-6 rounded-2xl border border-brand-primary/10 mb-8">
                  <h3 className="text-xl font-bold text-brand-primary mb-2 flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-brand-highlight" /> Smaakprofiel
                  </h3>
                  <p className="m-0 italic">{product.tasteNotes}</p>
                </div>
              )}

              <p className="leading-relaxed">
                Ideaal om zo te eten, door je ontbijt te mengen of om te gebruiken in baksels en
                salades. Onze producten worden met liefde geselecteerd en verpakt, zodat jij geniet
                van de pure ambachtelijke kwaliteit die we al jaren bieden.
              </p>
              <p className="mt-6 font-bold text-brand-primary text-xl">
                Voor wie houdt van pure eenvoud en rijke smaak.
              </p>
            </div>
          </div>

          {/* Specs & Extra Info */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="bg-brand-primary text-white rounded-[2rem] p-8 lg:p-12 shadow-xl border border-brand-gold/40 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url('/Branding/Lookenfeel.png')`,
                  backgroundSize: "cover",
                }}
              ></div>
              <h2 className="text-2xl font-bold text-brand-gold mb-8 relative z-10">
                Specificaties
              </h2>
              <div className="divide-y divide-brand-gold/20 text-base relative z-10">
                <div className="py-4 flex justify-between items-center">
                  <span className="text-brand-gold/80">SKU</span>
                  <span className="font-bold">{product.sku}</span>
                </div>
                <div className="py-4 flex justify-between items-center">
                  <span className="text-brand-gold/80">Merk</span>
                  <span className="font-bold text-brand-highlight">DeNotenman</span>
                </div>
                {product.origin && (
                  <div className="py-4 flex justify-between items-center">
                    <span className="text-brand-gold/80">Herkomst</span>
                    <span className="font-bold">{product.origin}</span>
                  </div>
                )}
                {product.allergens.length > 0 && (
                  <div className="py-4 flex flex-col gap-2">
                    <span className="text-brand-gold/80">Allergenen</span>
                    <span className="font-medium text-surface/90 leading-snug">
                      Kan sporen bevatten van: gluten, pinda, amandel, hazelnoot, walnoot,
                      cashewnoot, pecannoot, paranoot, pistachenoot en macadamianoot.
                      <br />
                      <br />
                      <strong className="text-brand-gold">Bevat:</strong>{" "}
                      {product.allergens.join(", ")}
                    </span>
                  </div>
                )}
                <div className="py-4 flex flex-col gap-2 border-b-0">
                  <span className="text-brand-gold/80">Bewaaradvies</span>
                  <span className="font-medium text-surface/90">
                    {product.storageInfo ??
                      "Koel, droog en donker bewaren. Na openen beperkt houdbaar."}
                  </span>
                </div>
              </div>
            </div>

            <ProductUspBox />
          </div>
        </div>
      </div>
    </div>
  );
}
