import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerServicePage } from "../components/customer-service/CustomerServicePage";
import {
  getAnnouncementTickerCopy,
  getCustomerServiceCopy,
} from "../lib/customer-service-content";
import { pagePath } from "../lib/pages";
import nl from "../dictionaries/nl.json";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

test("Dutch customer service content stays grounded in the configured webshop facts", () => {
  const copy = getCustomerServiceCopy("nl");

  // 7 original ordering/shipping/product entries, plus 7 legal-document
  // entries (terms, additional terms, privacy, cookies, cookie settings,
  // withdrawal, processing agreement) so every footer legal link also has
  // an FAQ answer with the matching document.
  assert.equal(copy.entries.length, 14);
  assert.deepEqual(
    copy.entries.filter((entry) => entry.category === "Voorwaarden & beleid").map((entry) => entry.id),
    ["terms", "additional-terms", "privacy", "cookies", "cookie-settings", "withdrawal", "processing-agreement"]
  );
  assert.deepEqual(
    copy.marketVisits.map(({ day, location, hours }) => ({ day, location, hours })),
    [
      { day: "Donderdag", location: "Hilvarenbeek", hours: "08:00–12:00" },
      { day: "Vrijdag", location: "Uden", hours: "08:00–12:30" },
      { day: "Zaterdag", location: "Antwerpen", hours: "08:00–16:00" },
    ]
  );
  assert.equal(copy.postalAddress, "De Notenman, Oude Baan 7a, 5076 PJ Haaren");
  assert.equal(copy.email, "info@denotenman.com");
  assert.equal(copy.whatsappUrl, "https://wa.me/31411700232");
  assert.equal(copy.phoneDisplay, "+31 411 700 232");
  assert.equal(copy.phoneHref, "tel:+31411700232");
  assert.deepEqual(copy.phoneHours.slice(0, 5).map((item) => item.hours), [
    "11:00–15:00",
    "11:00–15:00",
    "11:00–15:00",
    "11:00–15:00",
    "11:00–15:00",
  ]);
  assert.equal(copy.phoneHours[5]?.hours, "Gesloten");
  assert.equal(copy.phoneHours[6]?.hours, "Gesloten");
  assert.match(copy.scopeText, /uitsluitend informatie die op de webshop/);
  assert.equal(copy.resultCountSingular, "1 antwoord gevonden");
});

test("customer service page renders usable contact links and the market route", () => {
  const markup = renderToStaticMarkup(
    <CustomerServicePage locale="nl" copy={getCustomerServiceCopy("nl")} />
  );

  assert.match(markup, /<h1[^>]*>Waar kunnen we je mee helpen\?<\/h1>/);
  assert.match(markup, /De Notenman, Oude Baan 7a, 5076 PJ Haaren/);
  assert.match(markup, /href="mailto:info@denotenman\.com"/);
  assert.match(markup, /href="tel:\+31411700232"/);
  assert.match(markup, /href="https:\/\/wa\.me\/31411700232"/);
  assert.match(markup, /href="\/nl\/paginas\/markten"/);
  assert.match(markup, /Donderdag/);
  assert.match(markup, /Hilvarenbeek/);
  assert.match(markup, /Telefonisch zijn wij alleen bereikbaar/);
});

test("customer service route and metadata are localized without relying on a database page", () => {
  assert.equal(pagePath("faq", "nl"), "/nl/paginas/veelgestelde-vragen");
  assert.equal(pagePath("faq", "en"), "/en/pages/faq");
  assert.equal(pagePath("faq", "fr"), "/fr/pages/faq");

  const routeSource = readFileSync("app/[locale]/pages/[slug]/page.tsx", "utf8");
  assert.match(routeSource, /if \(key === "faq"\)/);
  assert.match(routeSource, /getCustomerServiceCopy\(locale\)/);
  assert.match(routeSource, /getAlternates\(locale, \{ type: "page", key \}\)/);
  assert.match(routeSource, /canonical: alternates\.canonical/);
  assert.match(routeSource, /languages: alternates\.languages/);
});

test("announcement content uses every localized storefront USP and the shipping rule", () => {
  const dictionaries = { nl, en, fr };
  for (const locale of ["nl", "en", "fr"] as const) {
    const copy = getAnnouncementTickerCopy(locale, dictionaries[locale].usp);
    assert.equal(copy.items.length, 4);
    assert.deepEqual(
      copy.items.slice(0, 3).map((item) => item.text),
      Object.values(dictionaries[locale].usp)
    );
    assert.equal(copy.items[3]?.id, "free-shipping");
    assert.match(copy.items[3]?.text ?? "", /50/);
  }
});
