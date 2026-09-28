import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  indexablePageKeys,
  pageRobots,
  pageSlugs,
  type PageKey,
} from "../lib/pages";

test("newsletter utility pages stay routable but are excluded from sitemap page keys", () => {
  assert.equal(pageSlugs.optOut.nl, "afmelden-nieuwsbrief");
  assert.equal(indexablePageKeys.some((key) => (key as PageKey) === "optOut"), false);
  assert.equal(indexablePageKeys.some((key) => (key as PageKey) === "subscribe"), false);
});

test("newsletter utility pages use noindex,follow while content pages keep default robots", () => {
  assert.deepEqual(pageRobots("optOut"), { index: false, follow: true });
  assert.deepEqual(pageRobots("subscribe"), { index: false, follow: true });
  assert.equal(pageRobots("about"), undefined);
});

test("footer utility links resolve to implemented storefront experiences", async () => {
  const [contentPage, footer, optOutPage] = await Promise.all([
    readFile(path.join(process.cwd(), "app/[locale]/pages/[slug]/page.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "components/layout/Footer.tsx"), "utf8"),
    readFile(
      path.join(process.cwd(), "app/[locale]/pages/[slug]/_components/NewsletterOptOut.tsx"),
      "utf8",
    ),
  ]);

  assert.match(contentPage, /key === "faq" \|\| key === "contact"/);
  assert.match(contentPage, /key === "subscribe"/);
  assert.match(contentPage, /redirect\(`\/\$\{locale\}#newsletter-signup`\)/);
  assert.match(contentPage, /<NewsletterOptOut locale=\{locale\} \/>/);
  assert.match(footer, /href=\{`\$\{homePath\(locale\)\}#newsletter-signup`\}/);
  assert.match(optOutPage, /persoonlijke afmeldlink/i);
  assert.match(optOutPage, /aria-labelledby="newsletter-opt-out-title"/);
  assert.doesNotMatch(optOutPage, /<main/);
});
