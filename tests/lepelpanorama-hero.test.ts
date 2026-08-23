import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const assetDirectory = path.join("public", "lepelpanorama");

test("the production hero keeps the supplied runtime and complete asset set", async () => {
  const [html, panoramaTiles, productImages, spoonLayers] = await Promise.all([
    readFile(path.join(assetDirectory, "interactieve-lepelpanorama.html"), "utf8"),
    readdir(path.join(assetDirectory, "panorama-tiles")),
    readdir(path.join(assetDirectory, "product-images")),
    readdir(path.join(assetDirectory, "spoon-layers")),
  ]);

  assert.equal(panoramaTiles.length, 5);
  assert.equal(productImages.length, 19);
  assert.equal(spoonLayers.filter((name) => /^spoon-\d{2}\.png$/.test(name)).length, 40);
  assert.equal(
    spoonLayers.filter((name) => /^spoon-background-\d{2}\.png$/.test(name)).length,
    40
  );
  assert.equal((await stat(path.join(assetDirectory, "notenman-noot-icon.png"))).isFile(), true);

  assert.match(html, /viewport\.addEventListener\('pointermove'/);
  assert.match(html, /viewport\.addEventListener\('wheel'/);
  assert.match(html, /function startTour\(\)/);
  assert.match(html, /function openProduct\(/);
  assert.match(html, /function setActiveSpoon\(/);
  assert.match(html, /visibleSpoonFraction = 0\.75/);
  assert.match(html, /state\.baseScale = viewport\.clientHeight/);
  assert.match(html, /state\.y = 0/);
  assert.match(html, /prefers-reduced-motion: reduce/);
});

test("the homepage renders the isolated, height-limited panorama and no preview route", async () => {
  const [component, styles, homepage, config] = await Promise.all([
    readFile("components/home/LepelPanoramaHero.tsx", "utf8"),
    readFile("components/home/LepelPanoramaHero.module.css", "utf8"),
    readFile("app/[locale]/page.tsx", "utf8"),
    readFile("next.config.ts", "utf8"),
  ]);

  assert.match(component, /\/lepelpanorama\/interactieve-lepelpanorama\.html/);
  assert.match(component, /sandbox="allow-scripts"/);
  assert.match(homepage, /<LepelPanoramaHero\s*\/>/);
  assert.doesNotMatch(homepage, /<VisualHero|getHomeSliderProducts|heroProducts/);
  assert.match(config, /source:\s*"\/lepelpanorama\/:path\*"/);
  assert.match(config, /X-Robots-Tag/);
  assert.match(styles, /height:\s*clamp\(24rem, 56svh, 30rem\)/);
  assert.match(styles, /@media \(min-width: 721px\)/);
  assert.match(styles, /height:\s*clamp\(30rem, 68svh, 42rem\)/);
  assert.doesNotMatch(styles, /height:\s*100svh/);
  assert.doesNotMatch(component, /preview-assets|Concept/);
});
