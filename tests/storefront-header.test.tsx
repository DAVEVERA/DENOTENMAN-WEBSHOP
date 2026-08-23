import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { HeaderActions } from "../components/layout/HeaderActions";
import { LocaleSwitcher } from "../components/layout/LocaleSwitcher";
import { MobileNav } from "../components/layout/MobileNav";
import nl from "../dictionaries/nl.json";

test("desktop customer service opens the configured WhatsApp Business number", () => {
  const markup = renderToStaticMarkup(
    <HeaderActions locale="nl" dictionary={nl} />
  );

  assert.match(markup, />Zakelijk<\/a>/);
  assert.match(markup, />Klantenservice<\/a>/);
  assert.match(markup, />Waar is DE NOTENMAN<\/a>/);
  assert.match(markup, /href="\/nl\/paginas\/contact"/);
  assert.match(markup, /href="\/nl\/paginas\/markten"/);
  assert.match(markup, /href="https:\/\/wa\.me\/31411700232"[^>]*>Klantenservice<\/a>/);
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
  assert.match(source, /CUSTOMER_SERVICE_WHATSAPP_URL/);
  assert.match(source, /dictionary\.nav\.customerService/);
  assert.doesNotMatch(markup, /fixed bottom-/);
});
