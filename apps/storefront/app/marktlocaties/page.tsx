import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveMarketMap } from "../../components/market/InteractiveMarketMap";
import { MARKET_LOCATIONS } from "../../lib/market-locations";
import { getOrganizationJsonLd, serializeJsonLd, SITE_NAME } from "../../lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: `Marktlocaties | ${SITE_NAME}`,
  },
  description:
    "Bekijk waar De Notenman op de markt staat in Anvers, Hilvarenbeek, Uden en Haaren.",
  alternates: {
    canonical: "/marktlocaties",
  },
};

export default function MarketLocationsPage() {
  const jsonLd = getOrganizationJsonLd(MARKET_LOCATIONS);

  return (
    <main className="market-locations-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <section className="market-locations-hero" aria-labelledby="market-locations-title">
        <div className="container market-locations-hero__inner">
          <div className="market-locations-hero__copy">
            <p>Marktlocaties</p>
            <h1 id="market-locations-title">Waar staat De Notenman deze week?</h1>
            <span>
              Klik op de kaart en zie direct op welke dag we in jouw buurt staan. Op de markt koop
              je dezelfde dagverse noten, pitten, zaden en zuidvruchten als online.
            </span>
            <div className="market-locations-hero__actions">
              <Link href="/winkel">Bestel online</Link>
              <Link href="/klantenservice/contact">Vraag iets over de markt</Link>
            </div>
          </div>

          <InteractiveMarketMap />
        </div>
      </section>

      <section className="container market-locations-list" aria-label="Alle marktlocaties">
        {MARKET_LOCATIONS.map((location) => (
          <article key={location.name} className="market-location-card">
            <span>{location.city}</span>
            <h2>{location.name}</h2>
            <p>{location.label}</p>
          </article>
        ))}
      </section>

      <section className="container seo-facts seo-facts--market" aria-labelledby="market-facts-title">
        <p>De Notenman in het kort</p>
        <h2 id="market-facts-title">Marktkwaliteit met online bestelgemak</h2>
        <div className="seo-facts__grid">
          <article>
            <h3>Wekelijkse markt</h3>
            <p>De Notenman staat wekelijks in Anvers, Hilvarenbeek, Uden en Haaren.</p>
          </article>
          <article>
            <h3>Assortiment</h3>
            <p>Op de markt en online vind je noten, pitten, zaden, zuidvruchten, snacks en superfoods.</p>
          </article>
          <article>
            <h3>Webshop</h3>
            <p>Je kunt dezelfde selectie online bestellen en per gewenste besteleenheid afrekenen.</p>
          </article>
          <article>
            <h3>Service</h3>
            <p>Vragen over marktvoorraad, levering of zakelijke bestellingen lopen via de klantenservice.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
