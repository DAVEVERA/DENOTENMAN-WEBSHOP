import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aftersalesEmailDeliveryKind } from "../lib/aftersales/email-kind";
import {
  reviewActionUrlOverrideFor,
  reviewRequestOutcome,
  type ReviewRequestVerdict,
} from "../lib/review-requests";

const VALID_URL = "https://search.google.com/local/writereview?placeid=TEST";

test("the review request maps to its own email delivery kind", () => {
  assert.equal(aftersalesEmailDeliveryKind("REVIEW_REQUEST"), "REVIEW_REQUEST");
  assert.equal(aftersalesEmailDeliveryKind("ORDER_PAID"), "ORDER_CONFIRMATION");
  assert.equal(aftersalesEmailDeliveryKind("BUSINESS_ORDER_PAID"), "ORDER_CONFIRMATION");
  assert.equal(aftersalesEmailDeliveryKind("ORDER_FULFILLED"), "ORDER_FULFILLED");
  assert.equal(aftersalesEmailDeliveryKind("BACK_IN_STOCK"), "BACK_IN_STOCK");
});

test("only the review request trigger gets an action url override", () => {
  assert.equal(reviewActionUrlOverrideFor("REVIEW_REQUEST", VALID_URL), VALID_URL);
  assert.equal(reviewActionUrlOverrideFor("ORDER_FULFILLED", VALID_URL), null);
  assert.equal(reviewActionUrlOverrideFor("ORDER_PAID", VALID_URL), null);
});

test("an unusable review url yields no override rather than a broken one", () => {
  assert.equal(reviewActionUrlOverrideFor("REVIEW_REQUEST", null), null);
  assert.equal(reviewActionUrlOverrideFor("REVIEW_REQUEST", ""), null);
  assert.equal(reviewActionUrlOverrideFor("REVIEW_REQUEST", "https://g.page/r/ABC/review"), null);
});

test("an eligible verdict sends", () => {
  const verdict: ReviewRequestVerdict = { eligible: true, warnings: [] };
  assert.deepEqual(reviewRequestOutcome(verdict), { action: "send" });
});

test("the two frequency blocks are recorded as a deliberate skip", () => {
  for (const reason of ["WITHIN_FREQUENCY_WINDOW", "ALREADY_SENT_FOR_ORDER"] as const) {
    assert.deepEqual(reviewRequestOutcome({ eligible: false, reason, warnings: [] }), {
      action: "skip",
      reason,
    });
  }
});

test("every other block is refused without leaving a row behind", () => {
  for (const reason of ["NO_REVIEW_URL", "TEST_ORDER", "BUSINESS_ORDER", "NOT_DELIVERED_YET"] as const) {
    assert.deepEqual(reviewRequestOutcome({ eligible: false, reason, warnings: [] }), {
      action: "refuse",
      reason,
    });
  }
});

test("the delivery path resolves the review url and hands it to the renderer", async () => {
  const source = await readFile("lib/aftersales/service.ts", "utf8");
  assert.match(source, /reviewActionUrlOverrideFor/, "service does not resolve an override");
  assert.match(source, /REVIEW_URL_SETTING_KEY/, "service does not read the review url setting");
  const renderCall = source.slice(
    source.indexOf("const rendered = renderAftersalesEmail("),
    source.indexOf("const idempotencyKey")
  );
  assert.ok(renderCall.length > 0, "the render call moved; this guard needs updating");
  assert.match(renderCall, /actionUrlOverride/, "the override is not passed to renderAftersalesEmail");
});

test("sending records a skip instead of mailing when the frequency rules say so", async () => {
  const source = await readFile("lib/review-requests-db.ts", "utf8");
  assert.match(source, /reviewRequestOutcome/, "the send path does not use the outcome branching");
  assert.match(source, /"SKIPPED"/, "the send path never records a SKIPPED delivery");
  assert.match(source, /dispatchAftersalesEvent\(/, "the send path does not dispatch through aftersales");
});
