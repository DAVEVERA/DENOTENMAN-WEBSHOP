import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";

import { VideoHero } from "../components/layout/VideoHero";
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
      <VideoHero locale="en" dictionary={en} />
    </ImageConfigContext.Provider>,
  );

  assert.match(markup, /fetchpriority="high"/i);
  assert.match(markup, /loading="eager"/i);
  assert.match(markup, /\/_next\/image\?url=/);
  assert.match(markup, /sizes="\(max-width: 759px\) calc\(100vw - 48px\), 112px"/);
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

test("analytics waits until load and optimized images receive a durable cache", async () => {
  const [layout, config] = await Promise.all([
    projectFile("app/[locale]/layout.tsx"),
    projectFile("next.config.ts"),
  ]);

  assert.match(layout, /src=\{`https:\/\/www\.googletagmanager\.com\/gtag\/js/);
  assert.match(layout, /strategy="lazyOnload"/);
  assert.match(config, /minimumCacheTTL:\s*2678400/);
  assert.match(config, /qualities:\s*\[70, 75\]/);
});

test("Mailchimp connected-site tracking is scoped to the storefront and loaded lazily", async () => {
  const [storefrontLayout, adminLayout] = await Promise.all([
    projectFile("app/[locale]/layout.tsx"),
    projectFile("app/admin/layout.tsx"),
  ]);

  assert.match(storefrontLayout, /id="mcjs"/);
  assert.match(
    storefrontLayout,
    /https:\/\/chimpstatic\.com\/mcjs-connected\/js\/users\/8acdcbab41d6c9a77789a5c6e\/e153af6949eb3f4d24a641635\.js/,
  );
  assert.match(storefrontLayout, /id="mcjs"[\s\S]*?strategy="lazyOnload"/);
  assert.doesNotMatch(adminLayout, /chimpstatic|id="mcjs"/);
});
