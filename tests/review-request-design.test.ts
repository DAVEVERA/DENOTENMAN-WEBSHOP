import assert from "node:assert/strict";
import test from "node:test";
import { renderAftersalesEmail } from "../lib/aftersales/template";
import { AFTERSALES_TOKENS_BY_TRIGGER } from "../lib/aftersales/schema";
import { reviewRequestStepContent } from "../lib/aftersales/step-defaults";

const REVIEW_URL = "https://search.google.com/local/writereview?placeid=TEST";

type RenderArgs = Parameters<typeof renderAftersalesEmail>;

const order = {
  id: "ord_1",
  orderNumber: "DN-2026-01423",
  locale: "nl",
  currency: "EUR",
  contactName: "Sanne Jansen",
  contactEmail: "sanne@example.com",
  subtotalCents: 2450,
  discountCents: 0,
  shippingCents: 0,
  totalCents: 2450,
  deliveryMethod: "SHIPPING",
  shippingPostalCode: "1234AB",
  shippingCountry: "NL",
  postnlTrackingCode: null,
  items: [],
} as unknown as RenderArgs[0];

const content = reviewRequestStepContent();

function render(locale: "nl" | "en" | "fr" = "nl") {
  const localeContent = content.locales[locale];
  return renderAftersalesEmail(
    { ...order, locale } as RenderArgs[0],
    "REVIEW_REQUEST",
    localeContent,
    content.canvas,
    localeContent.blockText,
    content.design,
    null,
    REVIEW_URL
  );
}

test("the review mail renders the approved Google block", () => {
  const { html } = render();
  assert.match(html, /Beoordelingen/, "the Google block heading is missing");
  for (const colour of ["#4285F4", "#EA4335", "#FBBC05", "#34A853"]) {
    assert.ok(html.includes(colour), `the Google wordmark colour ${colour} is missing`);
  }
  assert.match(html, /Bent u tevreden over onze service\?/);
  assert.ok(html.includes("#1a73e8"), "the approved blue button is missing");
  assert.match(html, /Laat een review achter/);
});

test("the mail shows five stars", () => {
  const { html } = render();
  const stars = (html.match(/&#9733;/g) ?? []).length;
  assert.equal(stars, 5, `expected five stars, found ${stars}`);
});

test("the stars and the button lead to exactly the same place", () => {
  const { html } = render();
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length >= 2, `expected the stars and the button to be links, found ${hrefs.length}`);
  // No per-rating destination anywhere: that is what review gating would be.
  assert.deepEqual([...new Set(hrefs)], [REVIEW_URL]);
});

test("the opt-out line sits below the Google block", () => {
  const { html } = render();
  const block = html.indexOf("Beoordelingen");
  const optOut = html.search(/afmeld/i);
  assert.ok(block >= 0 && optOut >= 0, "block or opt-out line missing");
  assert.ok(optOut > block, "the opt-out line is rendered above the Google block");
});

test("the Google block ships in every locale", () => {
  for (const locale of ["nl", "en", "fr"] as const) {
    const { html } = render(locale);
    assert.match(html, /Beoordelingen|Reviews|Avis/, `${locale} has no Google block`);
    assert.ok(html.includes(REVIEW_URL), `${locale} has no review link`);
  }
});

test("the design uses no token the review trigger disallows", () => {
  const allowed = new Set(AFTERSALES_TOKENS_BY_TRIGGER.REVIEW_REQUEST);
  for (const locale of ["nl", "en", "fr"] as const) {
    const localeContent = content.locales[locale];
    const texts = [
      localeContent.subject,
      localeContent.previewText,
      localeContent.heading,
      localeContent.body,
      localeContent.buttonLabel,
      ...Object.values(localeContent.blockText),
    ];
    for (const text of texts) {
      for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        assert.ok(allowed.has(match[1]), `${locale} uses disallowed token {{${match[1]}}}`);
      }
    }
  }
});
