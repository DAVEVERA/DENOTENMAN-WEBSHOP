import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductFaqAccordion } from "../components/product/ProductFaqAccordion";
import { ProductEditorNav } from "../components/admin-panel/ProductEditorNav";
import { buildProductStructuredData } from "../lib/structured-data";
import type { ProductDetailDto } from "../lib/queries";
import type { StorefrontProductFaq } from "../lib/product-faq";

const faqEditorSource = readFileSync(join(process.cwd(), "components/admin-panel/ProductFaqEditor.tsx"), "utf8");
const richTextEditorSource = readFileSync(join(process.cwd(), "components/admin-panel/FaqRichTextEditor.tsx"), "utf8");

const faq: StorefrontProductFaq = {
  id: "faq-1",
  question: "Hoe bewaar ik dit product?",
  answerHtml: "<p>Koel en <strong>droog</strong>.</p>",
  placement: "BELOW_PRODUCT_DETAILS",
  sortOrder: 0,
  media: null,
};

const product: ProductDetailDto = {
  id: "product-1",
  sku: "NOOT-1",
  slug: "noten",
  name: "Noten",
  description: "Verse noten.",
  descriptionHtml: null,
  shortDescription: "Verse noten.",
  seoTitle: null,
  metaDescription: null,
  promotionText: null,
  basePriceCents: 500,
  regularBasePriceCents: 500,
  salePriceCents: null,
  hasVariablePrice: false,
  currency: "EUR",
  unit: "WEIGHT",
  isActive: true,
  images: [],
  variants: [],
  category: null,
  updatedAt: new Date("2026-08-20T00:00:00Z"),
  slugsByLocale: { nl: "noten" },
  attributes: [],
  recommendations: [],
  faqs: {
    BELOW_DESCRIPTION: [],
    BELOW_PRODUCT_DETAILS: [faq],
    BEFORE_REVIEWS: [],
    PAGE_BOTTOM: [],
  },
};

test("FAQ accordion renders no wrapper for an empty placement", () => {
  assert.equal(
    renderToStaticMarkup(<ProductFaqAccordion items={[]} locale="nl" placement="PAGE_BOTTOM" />),
    "",
  );
});

test("FAQ accordion exposes an accessible keyboard-ready disclosure", () => {
  const html = renderToStaticMarkup(
    <ProductFaqAccordion items={[faq]} locale="nl" placement="BELOW_PRODUCT_DETAILS" />,
  );
  assert.match(html, /Veelgestelde vragen/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="faq-panel-BELOW_PRODUCT_DETAILS-faq-1"/);
  assert.match(html, /role="region"/);
  assert.match(html, /Koel en <strong>droog<\/strong>/);
});

test("FAQ media uses safe non-autoplay video and external PDF links", () => {
  const video = { ...faq, id: "video", media: { id: "media-video", type: "INSTRUCTION" as const, url: "https://storage.example/video.mp4", label: "Roosterinstructie", contentType: "video/mp4", originalFilename: "instructie.mp4", fileSize: 10, width: null, height: null, pageCount: null, durationMs: null } };
  const pdf = { ...faq, id: "pdf", media: { id: "media-pdf", type: "INFOGRAPHIC" as const, url: "https://storage.example/info.pdf", label: "Bewaaradvies", contentType: "application/pdf", originalFilename: "advies.pdf", fileSize: 10, width: null, height: null, pageCount: 1, durationMs: null } };
  const html = renderToStaticMarkup(<ProductFaqAccordion items={[video, pdf]} locale="nl" placement="BELOW_PRODUCT_DETAILS" />);
  assert.match(html, /<video controls="" preload="metadata"/);
  assert.doesNotMatch(html, /autoplay/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("product structured data includes FAQPage only when visible FAQ exists", () => {
  const withFaq = buildProductStructuredData({ product, locale: "nl", baseUrl: "https://denotenman.nl" });
  const withoutFaq = buildProductStructuredData({ product: { ...product, faqs: undefined }, locale: "nl", baseUrl: "https://denotenman.nl" });
  const faqPage = withFaq["@graph"].find((entry) => entry["@type"] === "FAQPage") as
    | { mainEntity: Array<{ acceptedAnswer: { text: string } }> }
    | undefined;
  assert.ok(faqPage);
  assert.equal(faqPage.mainEntity[0].acceptedAnswer.text, "Koel en droog.");
  assert.equal(withoutFaq["@graph"].some((entry) => entry["@type"] === "FAQPage"), false);
});

test("product edit navigation uses separate route tabs", () => {
  const html = renderToStaticMarkup(<ProductEditorNav productId="product-1" active="faq" />);
  assert.match(html, /href="\/admin\/producten\/product-1"/);
  assert.match(html, /href="\/admin\/producten\/product-1\/veelgestelde-vragen"/);
  assert.match(html, /aria-current="page"/);
});

test("FAQ locale tabs expose complete relationships and keyboard navigation", () => {
  assert.match(faqEditorSource, /aria-controls=\{faqLocalePanelId\(item\.id\)\}/);
  assert.match(faqEditorSource, /aria-labelledby=\{faqLocaleTabId\(item\.id, activeLocale\)\}/);
  assert.match(faqEditorSource, /tabIndex=\{activeLocale === locale\.id \? 0 : -1\}/);
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.match(faqEditorSource, new RegExp(`event\\.key === \"${key}\"`));
  }
});

test("FAQ rich-text toolbar actions also work from the keyboard", () => {
  assert.match(richTextEditorSource, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(richTextEditorSource, /command\(name, commandValue\)/);
  assert.match(richTextEditorSource, /addLink\(\)/);
});
