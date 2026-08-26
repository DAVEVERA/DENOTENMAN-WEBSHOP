import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { HeaderActions } from "../components/layout/HeaderActions";
import { LocaleSwitcher } from "../components/layout/LocaleSwitcher";
import { MobileNav } from "../components/layout/MobileNav";
import nl from "../dictionaries/nl.json";

test("desktop customer service opens the internal knowledge base", () => {
  const markup = renderToStaticMarkup(
    <HeaderActions locale="nl" dictionary={nl} />
  );

  assert.doesNotMatch(markup, />Zakelijk<\/a>/);
  assert.match(markup, />Klantenservice<\/a>/);
  assert.match(markup, />Vind DeNotenman<\/a>/);
  assert.match(markup, /href="\/nl\/paginas\/veelgestelde-vragen"[^>]*>Klantenservice<\/a>/);
  assert.match(markup, /href="\/nl\/paginas\/markten"/);
  assert.doesNotMatch(markup, /href="https:\/\/wa\.me\/31411700232"[^>]*>Klantenservice<\/a>/);
  assert.match(markup, /aria-label="Favorieten \(0\)"/);
  assert.match(markup, /aria-label="Winkelwagen \(0\)"/);
});

test("language switcher shows the current flag and keeps every locale reachable", () => {
  const markup = renderToStaticMarkup(
    <LocaleSwitcher
      currentLocale="nl"
      languages={{
        nl: "/nl",
        en: "/en",
        fr: "/fr",
      }}
    />
  );

  assert.match(markup, /<details/);
  assert.match(markup, /aria-label="Taal: Nederlands"/);
  assert.match(markup, /href="\/nl"/);
  assert.match(markup, /href="\/en"/);
  assert.match(markup, /href="\/fr"/);
});

test("mobile header exposes menu, search, account and cart as a top action row", () => {
  const markup = renderToStaticMarkup(
    <PathnameContext.Provider value="/nl">
      <MobileNav
        categories={[]}
        locale="nl"
        dictionary={nl}
        languages={{ nl: "/nl", en: "/en", fr: "/fr" }}
      />
    </PathnameContext.Provider>
  );

  assert.match(markup, />Menu<\/span>/);
  assert.match(markup, />Zoeken<\/span>/);
  assert.match(markup, />Account<\/span>/);
  assert.match(markup, />Winkelwagen<\/span>/);
  assert.match(markup, /href="\/nl\/account"/);
  assert.match(markup, /href="\/nl\/cart"/);
  const source = readFileSync("components/layout/MobileNav.tsx", "utf8");
  assert.match(source, /pagePath\("faq", locale\)/);
  assert.doesNotMatch(source, /CUSTOMER_SERVICE_WHATSAPP_URL/);
  assert.match(source, /dictionary\.nav\.customerService/);
  assert.doesNotMatch(markup, /fixed bottom-/);
});

test("header search uses one subtle pill-shaped field on mobile and desktop", () => {
  const source = readFileSync("components/layout/NavbarSearch.tsx", "utf8");

  assert.match(source, /rounded-full border border-border/);
  assert.doesNotMatch(source, /border-2 border-contrast/);
  assert.doesNotMatch(source, /border-\[3px\] border-contrast/);
});

test("the storefront logo remains present across mobile, tablet and desktop header layouts", () => {
  const headerSource = readFileSync("components/layout/Header.tsx", "utf8");
  const compactHeaderSource = readFileSync("components/layout/CompactHeader.tsx", "utf8");
  const logoSource = readFileSync("components/ui/Logo.tsx", "utf8");

  assert.match(headerSource, /<CompactHeader/);
  assert.match(compactHeaderSource, /aria-label=\{dictionary\.brand\.logoWordmarkAlt\}/);
  assert.match(compactHeaderSource, /parts="wordmark"\s+size="sm"/);
  assert.match(compactHeaderSource, /parts="wordmark"\s+size="lg"/);
  assert.match(compactHeaderSource, /xl:grid/);
  assert.match(logoSource, /nav: "h-12 min-\[400px\]:h-14 sm:h-16"/);
});
