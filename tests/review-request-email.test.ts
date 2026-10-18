import assert from "node:assert/strict";
import test from "node:test";
import { renderAftersalesEmail } from "../lib/aftersales/template";
import { resolveLegacyStepContent } from "../lib/aftersales/schema";
import { AFTERSALES_STEP_DEFAULTS } from "../lib/aftersales/step-defaults";

const REVIEW_URL = "https://search.google.com/local/writereview?placeid=TEST";
const TRACKING_CODE = "3STBJG123456789";

type RenderArgs = Parameters<typeof renderAftersalesEmail>;

function testOrder(): RenderArgs[0] {
  return {
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
    postnlTrackingCode: TRACKING_CODE,
    items: [],
  } as unknown as RenderArgs[0];
}

// The seeded review copy is the real content this mail ships with, so the
// rendering is exercised against it rather than against an invented canvas.
const seeded = resolveLegacyStepContent(AFTERSALES_STEP_DEFAULTS.REVIEW_REQUEST!.content);

function render(trigger: RenderArgs[1], actionUrlOverride?: string | null) {
  const locale = seeded.locales.nl;
  return renderAftersalesEmail(
    testOrder(),
    trigger,
    locale,
    seeded.canvas,
    locale.blockText,
    seeded.design,
    null,
    actionUrlOverride
  );
}

test("the review mail points its links at the override url", () => {
  const rendered = render("REVIEW_REQUEST", REVIEW_URL);
  assert.ok(rendered.html.includes(REVIEW_URL), "override url missing from the html");
  assert.ok(!rendered.html.includes("/nl/order/"), "the order page url is still in the html");
});

test("without an override the review mail still falls back to the order url", () => {
  const rendered = render("REVIEW_REQUEST");
  assert.ok(rendered.html.includes("/nl/order/ord_1"));
  assert.ok(!rendered.html.includes(REVIEW_URL));
});

test("the review mail has no order number box but keeps it in the text version", () => {
  const rendered = render("REVIEW_REQUEST", REVIEW_URL);
  assert.ok(!rendered.html.includes("<strong>Bestelnummer:</strong>"), "order number box is still rendered");
  assert.match(rendered.text, /Bestelnummer: DN-2026-01423/);
});

test("the fulfilled mail keeps its order number box", () => {
  const rendered = render("ORDER_FULFILLED", null);
  assert.ok(rendered.html.includes("<strong>Bestelnummer:</strong>"));
});

test("the review mail never shows a tracking code", () => {
  const rendered = render("REVIEW_REQUEST", REVIEW_URL);
  assert.ok(!rendered.html.includes(TRACKING_CODE), "tracking code leaked into the review html");
  assert.ok(!rendered.text.includes(TRACKING_CODE), "tracking code leaked into the review text");
});
