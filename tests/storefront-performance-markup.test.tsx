import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";

import { VisualHero } from "../components/layout/VisualHero";
import en from "../dictionaries/en.json";

const projectFile = (relativePath: string) =>
  readFile(path.join(process.cwd(), relativePath), "utf8");

const imageConfig = {
  ...imageConfigDefault,
  qualities: [70, 75],
  remotePatterns: [{ protocol: "https" as const, hostname: "storage.googleapis.com" }],
};

test("the homepage hero prioritizes only the LCP image and optimizes product imagery", async () => {
  const markup = renderToStaticMarkup(
    <ImageConfigContext.Provider value={imageConfig}>
      <VisualHero dictionary={en} />
    </ImageConfigContext.Provider>,
  );

  assert.match(markup, /fetchpriority="high"/i);
  assert.match(markup, /loading="eager"/i);
  assert.match(markup, /\/_next\/image\?url=/);
  assert.match(markup, /wellness-lifestyle-product-labels\.webp/);
  assert.match(markup, /sizes="100vw"/);
  assert.match(markup, />Nuts, honey and dried fruit from De Notenman<\/h1>/);
  assert.doesNotMatch(markup, /<a\b|<button\b/);
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
