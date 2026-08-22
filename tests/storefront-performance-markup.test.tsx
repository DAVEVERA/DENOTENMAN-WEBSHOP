import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectFile = (relativePath: string) =>
  readFile(path.join(process.cwd(), relativePath), "utf8");

test("the homepage hero prioritizes one LCP resource and eagerly loads only the initial loop window", async () => {
  const [slider, hero, contract] = await Promise.all([
    projectFile("components/home/HomeProductSlider.tsx"),
    projectFile("components/home/HomeProductHero.tsx"),
    projectFile("lib/home-product-slider.ts"),
  ]);

  assert.match(slider, /import Image from "next\/image"/);
  assert.match(slider, /index <= 2 \|\| index >= products\.length - 3 \? "eager" : "lazy"/);
  assert.match(slider, /fetchPriority=\{setIndex === 1 && index === 0 \? "high" : "auto"\}/);
  assert.match(slider, /sizes="\(max-width: 639px\) 46vw, \(max-width: 1023px\) 24vw, 13rem"/);
  assert.match(slider, /aria-roledescription="carousel"/);
  assert.match(hero, /<h1 id="home-product-hero-title" className="sr-only">/);
  assert.match(contract, /imageSrc: "\/product4slider\/abrikozen\.png"/);
});

test("storefront product cards use responsive Next images and unique link names", async () => {
  const source = await projectFile("components/product/ProductCard.tsx");

  assert.match(source, /import Image from "next\/image"/);
  assert.match(source, /<Image[\s\S]*?fill[\s\S]*?sizes=/);
  assert.match(source, /<span className="sr-only"> — \{product\.name\}<\/span>/);
  assert.doesNotMatch(source, /<img\b/);
});

test("featured products use optimized images and an accessible accent color", async () => {
  const [component, styles] = await Promise.all([
    projectFile("components/product/FeaturedBanner.tsx"),
    projectFile("app/globals.css"),
  ]);

  assert.match(component, /import Image from "next\/image"/);
  assert.match(component, /text-accent-ink/);
  assert.match(styles, /--color-accent-ink:\s*#806600/);
});

test("analytics is absent from the initial layout and optimized images receive a durable cache", async () => {
  const [layout, consent, analytics, config] = await Promise.all([
    projectFile("app/[locale]/layout.tsx"),
    projectFile("components/privacy/CookieConsent.tsx"),
    projectFile("components/analytics/GoogleAnalytics.tsx"),
    projectFile("next.config.ts"),
  ]);

  assert.doesNotMatch(layout, /googletagmanager\.com|chimpstatic\.com/);
  assert.match(layout, /<CookieConsent locale=\{locale\}/);
  assert.match(consent, /consent\?\.analytics/);
  assert.match(consent, /<GoogleAnalytics \/>/);
  assert.match(analytics, /googletagmanager\.com\/gtag\/js/);
  assert.match(analytics, /send_page_view: false/);
  assert.match(config, /minimumCacheTTL:\s*2678400/);
  assert.match(config, /qualities:\s*\[70, 75\]/);
});

test("Mailchimp connected-site tracking is consent-gated and excluded from admin", async () => {
  const [consent, adminLayout] = await Promise.all([
    projectFile("components/privacy/CookieConsent.tsx"),
    projectFile("app/admin/layout.tsx"),
  ]);

  assert.match(consent, /consent\?\.marketing/);
  assert.match(
    consent,
    /https:\/\/chimpstatic\.com\/mcjs-connected\/js\/users\/8acdcbab41d6c9a77789a5c6e\/e153af6949eb3f4d24a641635\.js/,
  );
  assert.match(consent, /id="mailchimp-connected-site"[\s\S]*?strategy="lazyOnload"/);
  assert.doesNotMatch(adminLayout, /chimpstatic|mailchimp-connected-site/);
});
