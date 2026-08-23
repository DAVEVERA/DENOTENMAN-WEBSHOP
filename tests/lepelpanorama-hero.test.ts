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

  const optimizedPanoramaTiles = panoramaTiles.filter((name) => /^panorama-\d{2}\.webp$/.test(name));
  const optimizedSpoonLayers = spoonLayers.filter((name) => /^spoon-(?:background-)?\d{2}\.webp$/.test(name));
  const panoramaBytes = (
    await Promise.all(optimizedPanoramaTiles.map((name) => stat(path.join(assetDirectory, "panorama-tiles", name))))
  ).reduce((total, file) => total + file.size, 0);
  const spoonBytes = (
    await Promise.all(optimizedSpoonLayers.map((name) => stat(path.join(assetDirectory, "spoon-layers", name))))
  ).reduce((total, file) => total + file.size, 0);

  assert.equal(optimizedPanoramaTiles.length, 5);
  assert.equal(productImages.length, 19);
  assert.equal(optimizedSpoonLayers.filter((name) => /^spoon-\d{2}\.webp$/.test(name)).length, 40);
  assert.equal(optimizedSpoonLayers.filter((name) => /^spoon-background-\d{2}\.webp$/.test(name)).length, 40);
  assert.ok(panoramaBytes < 1_200_000);
  assert.ok(spoonBytes < 1_300_000);
  assert.ok((await stat(path.join(assetDirectory, "notenman-noot-icon-64.webp"))).size < 3_000);

  assert.match(html, /panorama-01\.webp[^>]+fetchpriority="high"/);
  assert.match(html, /background\.dataset\.src = `spoon-layers\/spoon-background-/);
  assert.match(html, /function scheduleVisibleSpoonAssets\(\)/);
  assert.match(html, /notenman-noot-icon-64\.webp/);
  assert.doesNotMatch(html, /panorama-tiles\/panorama-\d{2}\.png/);
  assert.doesNotMatch(html, /spoon-layers\/spoon-(?:background-)?\$\{[^\n]+\.png/);
  assert.match(html, /viewport\.addEventListener\('pointermove'/);
  assert.match(html, /viewport\.addEventListener\('wheel'/);
  assert.match(html, /function startTour\(\)/);
  assert.match(html, /function openProduct\(/);
  assert.match(html, /function setActiveSpoon\(/);
  assert.match(html, /visibleSpoonFraction = 0\.75/);
  assert.match(html, /state\.baseScale = viewportMetrics\.height/);
  assert.match(html, /state\.y = 0/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(html, /navigator\s*\.\s*serviceWorker|serviceWorker\s*\./i);
  assert.doesNotMatch(html, /activeHotspot\.getBoundingClientRect|productPanel\.offset(?:Width|Height)/);
  assert.doesNotMatch(html, /window\.addEventListener\('resize'/);
  assert.doesNotMatch(html, /window\.(?:top|parent|opener|open)|document\.domain|<form\b/i);
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
  assert.doesNotMatch(component, /allow-same-origin/);
  assert.match(config, /default-src 'none'/);
  assert.match(config, /form-action 'none'/);
  assert.match(config, /frame-ancestors 'self'/);
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
