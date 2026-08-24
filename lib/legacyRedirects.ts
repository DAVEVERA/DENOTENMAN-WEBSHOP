/**
 * The old WordPress/WooCommerce site (denotenman.com, live since ~2018) had a
 * completely different URL structure. These redirects preserve the SEO
 * equity built up over years of indexing by 301-ing old URLs to their new
 * equivalents, instead of letting them 404 after the relaunch.
 *
 * Source: Wayback Machine CDX snapshot of denotenman.com taken 2026-08-14,
 * cross-referenced against the current product/category catalog.
 */

type Redirect = { source: string; destination: string; permanent: true };

const staticPages: [string, string][] = [
  ["/over-ons", "/nl/paginas/over-ons"],
  ["/contact-2-2", "/nl/paginas/contact"],
  ["/algemene-voorwaarden", "/nl/paginas/algemene-voorwaarden"],
  ["/privacyverklaring", "/nl/paginas/privacybeleid"],
  ["/retourneren-klachten", "/nl/paginas/verzenden-en-retourneren"],
  ["/nieuwsbrief", "/nl/paginas/aanmelden-nieuwsbrief"],
  ["/mijn-account", "/nl/account"],
  ["/winkelmand", "/nl/cart"],
  ["/winkelwagen", "/nl/cart"],
  ["/shop", "/nl/categorie"],
  ["/winkel", "/nl/categorie"],
  ["/product-tag/kiloknallers", "/nl/categorie/acties"],
];

const categoryPaths: [string, string][] = [
  ["/producten/noten", "noten"],
  ["/producten/noten/amandelen", "noten"],
  ["/producten/noten/borrelnoten", "noten"],
  ["/producten/noten/cashewnoten", "noten"],
  ["/producten/noten/hazelnoten", "noten"],
  ["/producten/noten/macadamianoten", "noten"],
  ["/producten/noten/noten", "noten"],
  ["/producten/noten/notenmixen", "notenmixen"],
  ["/producten/noten/paranoten", "noten"],
  ["/producten/noten/pecannoten", "noten"],
  ["/producten/noten/pindas", "pinda-s"],
  ["/producten/noten/pistaches", "noten"],
  ["/producten/noten/walnoten", "noten"],
  ["/producten/gedroogd-fruit", "gedroogd-fruit"],
  ["/producten/gedroogd-fruit/bosbessen", "gedroogd-fruit"],
  ["/producten/gedroogd-fruit/cranberries", "gedroogd-fruit"],
  ["/producten/gedroogd-fruit/dadels", "gedroogde-vruchten"],
  ["/producten/gedroogd-fruit/gedroogde-abrikozen", "gedroogde-vruchten"],
  ["/producten/gedroogd-fruit/gedroogde-vijgen", "gedroogde-vruchten"],
  ["/producten/gedroogd-fruit/gember", "gedroogde-vruchten"],
  ["/producten/gedroogd-fruit/gojibessen", "gedroogd-fruit"],
  ["/producten/gedroogd-fruit/incabessen", "superfood"],
  ["/producten/gedroogd-fruit/moerbeien", "superfood"],
  ["/producten/gedroogd-fruit/rozijnen-krenten", "gedroogde-vruchten"],
  ["/producten/gedroogd-fruit/zuidvruchten", "gedroogde-vruchten"],
  ["/producten/muesli-granen", "muesli-granen"],
  ["/producten/natuurvoeding", "honing-natuurvoeding"],
  ["/producten/natuurvoeding/honing", "honing-natuurvoeding"],
  ["/producten/natuurvoeding/natuurlijke-suikers-en-zoetstoffen", "honing-natuurvoeding"],
  ["/producten/bakproducten", "gedroogd-fruit"],
  ["/producten/crackers-zoutjes", "snacks-zoutjes"],
  ["/producten/snacks", "snacks-zoutjes"],
  ["/producten/snacks/crackers-zoutjes", "snacks-zoutjes"],
  ["/producten/snacks/chocolade", "chocolade-zoet"],
  ["/producten/snacks/zoetwaren", "chocolade-zoet"],
  ["/producten/notenpastas", "notenpasta-s"],
  ["/producten/pitten-zaden", "pitten-zaden"],
  ["/producten/superfood", "superfood"],
];

// Products that were renamed between the old and new catalog.
const renamedProducts: [string, string][] = [
  ["cranberrys-zonder-suiker", "cranberrys"],
  ["gemengde-bloemenhoning-cra%C2%A8me", "gemengde-bloemenhoning-creme"],
  ["kleine-vliespindas-gezouten", "gebrande-vliespindas-gezouten"],
  ["kleine-vliespindas-ongezouten", "gebrande-vliespindas-ongezouten"],
  ["pindas-ongezouten", "gebrande-pindas-ongezouten"],
  ["suikeramandelen-2", "suikeramandelen"],
];

// Products no longer sold. Sent to the closest matching category rather
// than a dead end.
const discontinuedProducts: [string, string][] = [
  ["acaciahoning-knijpflacon", "honing-natuurvoeding"],
  ["afrikaanse-boshoning", "honing-natuurvoeding"],
  ["agavesiroop-donker-rijk", "honing-natuurvoeding"],
  ["ahornsiroop", "honing-natuurvoeding"],
  ["berghoning-creme", "honing-natuurvoeding"],
  ["bijenbroodhoning", "honing-natuurvoeding"],
  ["biologische-klaverhoning", "honing-natuurvoeding"],
  ["bloemenhoning-knijpflacon", "honing-natuurvoeding"],
  ["blauwe-bessen", "gedroogde-vruchten"],
  ["bosbessen", "gedroogde-vruchten"],
  ["chocolade-pindarotsjes-caramel-zeezout", "chocolade-zoet"],
  ["chocolade-truffels", "chocolade-zoet"],
  ["dadelstroop", "honing-natuurvoeding"],
  ["gembersiroop", "honing-natuurvoeding"],
  ["gembersnippers", "gedroogde-vruchten"],
  ["healthy-disk-pruim-cranberry", "superfood"],
  ["kokosolie", "superfood"],
  ["koolzaadhoning", "honing-natuurvoeding"],
  ["korianderhoning", "honing-natuurvoeding"],
  ["lavendelhoning", "honing-natuurvoeding"],
  ["lindehoning-creme", "honing-natuurvoeding"],
  ["pestosticks", "snacks-zoutjes"],
  ["pistaches-gepeld-gebrand", "pistachenoten"],
  ["sinaasappelhoning-creme", "honing-natuurvoeding"],
  ["stemgember", "gedroogde-vruchten"],
  ["studenten-flikken-caramel-zeezout", "chocolade-zoet"],
  ["walnoten-chili-gepeld", "noten"],
  ["zoete-abrikozen", "gedroogde-vruchten"],
];

// Product URLs that existed in the current localized storefront but were
// removed from the catalog. Keep these explicit so a removed product never
// masks an active product with a coincidentally matching legacy slug.
const removedStorefrontProducts: [string, string][] = [
  ["pistaches-gepeld-gebrand", "pistachenoten"],
];

export function legacyWordpressRedirects(): Redirect[] {
  const redirects: Redirect[] = [];

  for (const [source, destination] of staticPages) {
    redirects.push({ source, destination, permanent: true });
  }

  for (const [source, categorySlug] of categoryPaths) {
    redirects.push({ source, destination: `/nl/categorie/${categorySlug}`, permanent: true });
  }

  for (const [oldSlug, newSlug] of renamedProducts) {
    redirects.push({
      source: `/product/${oldSlug}`,
      destination: `/nl/producten/${newSlug}`,
      permanent: true,
    });
  }

  for (const [oldSlug, categorySlug] of discontinuedProducts) {
    redirects.push({
      source: `/product/${oldSlug}`,
      destination: `/nl/categorie/${categorySlug}`,
      permanent: true,
    });
  }

  for (const [oldSlug, categorySlug] of removedStorefrontProducts) {
    redirects.push({
      source: `/nl/producten/${oldSlug}`,
      destination: `/nl/categorie/${categorySlug}`,
      permanent: true,
    });
  }

  // Catch-all for the majority of products whose slug didn't change.
  // Must come last: every explicit override above takes precedence.
  redirects.push({
    source: "/product/:slug",
    destination: "/nl/producten/:slug",
    permanent: true,
  });

  return redirects;
}
