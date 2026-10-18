import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewRequestButton } from "../app/admin/(dashboard)/bestellingen/ReviewRequestButton";

test("a blocked review button is disabled and names the reason", () => {
  const html = renderToStaticMarkup(
    <ReviewRequestButton orderId="ord_1" blockedReason="NO_REVIEW_URL" warnings={[]} />
  );
  // The className carries Tailwind's `disabled:` variants, so only the real
  // attribute counts.
  assert.ok(html.includes('disabled=""'), "the button is not actually disabled");
  assert.match(html, /Er is nog geen Google-reviewlink ingesteld\./);
});

test("every blocking reason reaches the admin as a sentence, not a code", () => {
  for (const reason of ["TEST_ORDER", "BUSINESS_ORDER", "NOT_DELIVERED_YET", "ALREADY_SENT_FOR_ORDER", "WITHIN_FREQUENCY_WINDOW"] as const) {
    const html = renderToStaticMarkup(
      <ReviewRequestButton orderId="ord_1" blockedReason={reason} warnings={[]} />
    );
    assert.ok(!html.includes(reason), `${reason} leaked as a raw code`);
  }
});

test("a ready review button is enabled and offers to send", () => {
  const html = renderToStaticMarkup(
    <ReviewRequestButton orderId="ord_1" blockedReason={null} warnings={[]} />
  );
  assert.ok(!html.includes('disabled=""'), "an unblocked button should not be disabled");
  assert.match(html, /Stuur reviewverzoek/);
});

test("a warned review button shows the warning before anything is sent", () => {
  const html = renderToStaticMarkup(
    <ReviewRequestButton orderId="ord_1" blockedReason={null} warnings={["REFUNDED", "DISPUTED"]} />
  );
  assert.match(html, /Deze bestelling is \(deels\) terugbetaald\./);
  assert.match(html, /Voor deze bestelling loopt een annuleringsverzoek\./);
});

test("the button posts to this order's review-request route and uses no browser dialog", async () => {
  const source = await readFile(
    "app/admin/(dashboard)/bestellingen/ReviewRequestButton.tsx",
    "utf8"
  );
  assert.match(source, /\/api\/admin\/orders\/\$\{orderId\}\/review-request/);
  assert.match(source, /method: "POST"/);
  // A modal dialog freezes the browser extension this project is driven with.
  assert.ok(!source.includes("window.confirm"), "browser dialogs block further automation");
  assert.match(source, /confirming/, "a warned send has no in-page confirmation step");
});

test("the route refuses anyone without order write access", async () => {
  const source = await readFile("app/api/admin/orders/[id]/review-request/route.ts", "utf8");
  assert.match(source, /getAdminSession/);
  assert.match(source, /can\(admin\.role, "orders", "write"\)/);
  assert.match(source, /isSameOriginMutation/);
});
