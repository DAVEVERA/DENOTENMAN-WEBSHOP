import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectFile = (relativePath: string) =>
  readFile(path.join(process.cwd(), relativePath), "utf8");

test("renders the squirrel artwork and localized homepage CTA", async () => {
  const component = await projectFile("components/layout/SquirrelEmptyState.tsx");

  assert.match(component, /src="\/pages\/SQUIRREL404\.PNG"/);
  assert.match(component, /cta: "Terug naar de hoofdpagina"/);
  assert.match(component, /cta: "Back to the homepage"/);
  assert.match(component, /cta: "Retour à l’accueil"/);
  assert.match(component, /href=\{`\/\$\{locale\}`\}/);
});

test("keeps the artwork decorative while exposing the message as real text", async () => {
  const component = await projectFile("components/layout/SquirrelEmptyState.tsx");

  assert.match(component, /alt=""/);
  assert.match(component, /aria-labelledby="squirrel-empty-title"/);
  assert.match(component, /title: "404 – Pagina is momenteel niet bereikbaar"/);
  assert.match(component, /Deze pagina maakt momenteel deel uit van een plaats delict/);
});

test("routes known empty content pages and unknown storefront URLs through the same state", async () => {
  const [contentPage, localeNotFoundPage, notFoundClient] = await Promise.all([
    projectFile("app/[locale]/pages/[slug]/page.tsx"),
    projectFile("app/[locale]/not-found.tsx"),
    projectFile("components/layout/SquirrelNotFoundPage.tsx"),
  ]);

  assert.match(contentPage, /<SquirrelEmptyState locale=\{locale\} \/>/);
  assert.match(localeNotFoundPage, /<SquirrelNotFoundPage \/>/);
  assert.match(notFoundClient, /usePathname\(\)/);
  assert.match(notFoundClient, /isLocale\(rawLocale\)/);
});

test("uses a full viewport layout, mobile-readable copy and a desktop image-aligned CTA", async () => {
  const component = await projectFile("components/layout/SquirrelEmptyState.tsx");

  assert.match(component, /<style>\{SQUIRREL_EMPTY_STYLES\}<\/style>/);
  assert.doesNotMatch(component, /SquirrelEmptyState\.module\.css/);
  assert.match(component, /min-block-size: 100svh/);
  assert.match(component, /min-block-size: 3rem/);
  assert.match(component, /object-position: 72% center/);
  assert.match(component, /@media \(min-width: 64rem\)/);
  assert.match(component, /clip-path: inset\(50%\)/);
  assert.match(component, /prefers-reduced-motion: reduce/);
});
