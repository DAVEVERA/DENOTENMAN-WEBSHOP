import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourceDirectory = path.join(
  "components",
  "home",
  "denotenman-hero-lepelpanorama"
);

test("the concept keeps the supplied panorama runtime and complete asset set", async () => {
  const [html, panoramaTiles, productImages, spoonLayers] = await Promise.all([
    readFile(path.join(sourceDirectory, "interactieve-lepelpanorama.html"), "utf8"),
    readdir(path.join(sourceDirectory, "panorama-tiles")),
    readdir(path.join(sourceDirectory, "product-images")),
    readdir(path.join(sourceDirectory, "spoon-layers")),
  ]);

  assert.equal(panoramaTiles.length, 5);
  assert.equal(productImages.length, 19);
  assert.equal(spoonLayers.filter((name) => /^spoon-\d{2}\.png$/.test(name)).length, 40);
  assert.equal(
    spoonLayers.filter((name) => /^spoon-background-\d{2}\.png$/.test(name)).length,
    40
  );
  assert.equal((await stat(path.join(sourceDirectory, "notenman-noot-icon.png"))).isFile(), true);

  assert.match(html, /viewport\.addEventListener\('pointermove'/);
  assert.match(html, /viewport\.addEventListener\('wheel'/);
  assert.match(html, /function startTour\(\)/);
  assert.match(html, /function openProduct\(/);
  assert.match(html, /function setActiveSpoon\(/);
  assert.match(html, /prefers-reduced-motion: reduce/);
});

test("the preview is isolated, noindex and leaves the current homepage hero unchanged", async () => {
  const [page, component, route, homepage] = await Promise.all([
    readFile("app/[locale]/concept/lepelpanorama/page.tsx", "utf8"),
    readFile("components/home/LepelPanoramaConcept.tsx", "utf8"),
    readFile("app/preview-assets/lepelpanorama/[...asset]/route.ts", "utf8"),
    readFile("app/[locale]/page.tsx", "utf8"),
  ]);

  assert.match(page, /index:\s*false/);
  assert.match(page, /follow:\s*false/);
  assert.match(component, /interactieve-lepelpanorama\.html/);
  assert.match(component, /sandbox="allow-scripts"/);
  assert.match(route, /candidate\.startsWith\(sourcePrefix\)/);
  assert.match(route, /X-Robots-Tag/);
  assert.match(homepage, /<VisualHero/);
  assert.doesNotMatch(homepage, /LepelPanoramaConcept|lepelpanorama/);
});
