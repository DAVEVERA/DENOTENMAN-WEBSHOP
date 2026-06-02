import type { Metadata } from "next";
import { MarketMapBlinkers, MarketPresence } from "../components/home/MarketPresence";
import { ProductGrid } from "../components/product/ProductGrid";
import { MARKET_LOCATIONS } from "../lib/market-locations";
import { listProducts } from "../lib/products";
import { DEFAULT_OG_IMAGE, getOrganizationJsonLd, serializeJsonLd, SITE_BASE_URL, SITE_NAME } from "../lib/seo";

export const metadata: Metadata = {
  title: "Noten, pitten, zaden en gedroogd fruit kopen",
  description:
    "Bestel dagverse noten, pitten, zaden, mixen en gedroogd fruit bij De Notenman.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_NAME,
    description:
      "Van markt tot webshop: noten, pitten, zaden, mixen en gedroogd fruit.",
    url: SITE_BASE_URL,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function HomePage() {
  const products = await listProducts();
  const jsonLd = getOrganizationJsonLd(MARKET_LOCATIONS);

  return (
    <main className="landing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <section className="landing-hero" aria-labelledby="landing-title">
        <MarketMapBlinkers />
        <div className="container landing-hero__inner">
          <h1 id="landing-title">Dagvers van markt tot webshop</h1>
          <MarketPresence />
        </div>
      </section>

      <section className="container seo-facts" aria-labelledby="seo-facts-title">
        <p>De Notenman in het kort</p>
        <h2 id="seo-facts-title">Dagverse noten uit de webshop en van de markt</h2>
        <div className="seo-facts__grid">
          <article>
            <h3>Wie is De Notenman?</h3>
            <p>De Notenman is een specialist in noten, pitten, zaden, mixen en gedroogd fruit.</p>
          </article>
          <article>
            <h3>Assortiment</h3>
            <p>Je bestelt onder meer noten, zuidvruchten, zaden, pitten, snacks en superfoods.</p>
          </article>
          <article>
            <h3>Marktlocaties</h3>
            <p>Je vindt De Notenman wekelijks op de markt in Anvers, Hilvarenbeek, Uden en Haaren.</p>
          </article>
          <article>
            <h3>Online bestellen</h3>
            <p>Producten worden online per besteleenheid gekozen, veilig afgerekend en snel geleverd.</p>
          </article>
        </div>
      </section>

      <section className="container landing-shop" aria-label="Producten ontdekken">
        <ProductGrid products={products} productLimit={16} showFilters />
      </section>
    </main>
  );
}
