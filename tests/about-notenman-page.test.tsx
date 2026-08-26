import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutNotenmanPage } from "../components/content/AboutNotenmanPage";

test("Dutch about page uses the supplied story, visible FAQs and brand CTAs", () => {
  const markup = renderToStaticMarkup(<AboutNotenmanPage />);

  assert.equal((markup.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((markup.match(/<details/g) ?? []).length, 5);
  assert.match(markup, /Over De Notenman/);
  assert.match(markup, /Noten kopen zoals op de markt/);
  assert.match(markup, /Maak kennis met Fedor/);
  assert.match(markup, /Op 6 juni 2020 ging denotenman\.com online/);
  assert.match(markup, /Vers gebrande noten/);
  assert.match(markup, /Persoonlijk advies, ook online/);
  assert.match(markup, /Dezelfde aandacht, waar je ook bestelt/);
  assert.match(markup, /FAQPage/);
  assert.match(markup, /%2Fabout%2Ffedor-market\.webp/);
  assert.match(markup, /%2Fabout%2Ffedor-nutbutters\.webp/);
  assert.match(markup, /%2Fabout%2Fmarket-route\.webp/);
  assert.match(markup, /href="\/nl\/categorie"/);
  assert.match(markup, /href="\/nl\/paginas\/markten"/);
  assert.match(markup, /href="\/nl\/paginas\/contact"/);
  assert.match(markup, /min-h-12/);
});

test("Dutch about metadata is fixed to the supplied SEO title and description", async () => {
  const source = await readFile("app/[locale]/pages/[slug]/page.tsx", "utf8");

  assert.match(source, /Over De Notenman \| Vers gebrande noten van de markt/);
  assert.match(
    source,
    /Maak kennis met Fedor en De Notenman\. Vers gebrande noten, gedroogd fruit en meer, op de markt en online vanuit Haaren\./,
  );
  assert.match(source, /locale === "nl" && key === "about"/);
  assert.match(source, /return <AboutNotenmanPage \/>/);
});

test("about photography is optimized and kept below the storefront asset ceiling", async () => {
  const assets = await Promise.all([
    stat("public/about/fedor-market.webp"),
    stat("public/about/fedor-nutbutters.webp"),
    stat("public/about/market-route.webp"),
  ]);

  for (const asset of assets) {
    assert.ok(asset.size > 10_000);
    assert.ok(asset.size < 250_000);
  }
});
