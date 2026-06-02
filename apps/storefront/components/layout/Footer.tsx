import Link from "next/link";
import type { CSSProperties } from "react";
import { MARKET_LOCATIONS } from "../../lib/market-locations";
import { Icon } from "../ui/Icon";

const footerGroups = [
  {
    title: "Webshop",
    links: [
      { href: "/winkel", label: "Winkel" },
      { href: "/categorie/noten", label: "Noten" },
      { href: "/categorie/zuidvruchten", label: "Gedroogd fruit" },
      { href: "/categorie/zaden-pitten", label: "Pitten & zaden" },
      { href: "/categorie/snacks", label: "Snacks" },
      { href: "/categorie/superfoods", label: "Superfoods" },
    ],
  },
  {
    title: "Service",
    links: [
      { href: "/klantenservice", label: "Klantenservice" },
      { href: "/klantenservice/verzenden", label: "Verzenden" },
      { href: "/klantenservice/retourneren", label: "Retourneren" },
      { href: "/klantenservice/betalen", label: "Betalen" },
      { href: "/klantenservice/veelgestelde-vragen", label: "Veelgestelde vragen" },
      { href: "/klantenservice/contact", label: "Contact" },
    ],
  },
  {
    title: "De Notenman",
    links: [
      { href: "/over-ons", label: "Over De Notenman" },
      { href: "/marktlocaties", label: "Marktlocaties" },
      { href: "/over-ons", label: "Markt & webshop" },
      { href: "/zakelijk", label: "Zakelijk bestellen" },
      { href: "/privacyverklaring", label: "Privacyverklaring" },
      { href: "/algemene-voorwaarden", label: "Algemene voorwaarden" },
    ],
  },
];

const footerTrustItems = [
  { icon: "truck_icon", label: "Snel verzonden", text: "Dagvers verpakt vanuit eigen voorraad." },
  { icon: "creditcard", label: "Veilig betalen", text: "Betalen via vertrouwde betaalmethodes." },
  { icon: "customer_service", label: "Persoonlijke service", text: "Hulp van mensen die het assortiment kennen." },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <section className="site-footer__brand" aria-labelledby="footer-brand-title">
          <img className="site-footer__logo" src="/Notenman_onlylogo.png" alt="De Notenman" />
          <h2 id="footer-brand-title">Dagvers van markt tot webshop</h2>
          <p>
            Je vindt De Notenman wekelijks op de markt in Anvers, Hilvarenbeek, Uden en Haaren.
            Online bestel je dezelfde selectie noten, pitten, zaden en gedroogd fruit gemakkelijk
            via de webshop.
          </p>
        </section>

        <section className="site-footer__trust" aria-label="Webshop zekerheden">
          {footerTrustItems.map((item) => (
            <div className="site-footer__trust-item" key={item.label}>
              <Icon name={item.icon} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.text}</small>
              </span>
            </div>
          ))}
        </section>

        <section className="site-footer__market" aria-labelledby="footer-market-title">
          <div className="site-footer__section-heading">
            <h2 id="footer-market-title">Marktlocaties</h2>
            <Link href="/marktlocaties">Bekijk onze route</Link>
          </div>

          <div className="site-footer__market-map" aria-label="Kaart met marktlocaties">
            <div className="site-footer__market-map-canvas">
              {MARKET_LOCATIONS.map((location) => (
                <Link
                  className="site-footer__map-marker"
                  href="/marktlocaties"
                  key={location.name}
                  style={
                    {
                      "--marker-x": `${location.x}%`,
                      "--marker-y": `${location.y}%`,
                    } as CSSProperties
                  }
                  aria-label={`Marktlocatie ${location.name}, ${location.label}`}
                >
                  <span aria-hidden="true" />
                  <strong>{location.name}</strong>
                </Link>
              ))}
            </div>

            <div className="site-footer__market-list">
              {MARKET_LOCATIONS.map((location) => (
                <Link href="/marktlocaties" key={location.name}>
                  <strong>{location.name}</strong>
                  <span>{location.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <nav className="site-footer__nav" aria-label="Footer navigatie">
          {footerGroups.map((group) => (
            <section className="site-footer__link-group" key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.href}-${link.label}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="site-footer__bottom">
          <span>{`Copyright ${new Date().getFullYear()} De Notenman`}</span>
          <span>Marktkwaliteit, online gemak.</span>
        </div>
      </div>
    </footer>
  );
}
