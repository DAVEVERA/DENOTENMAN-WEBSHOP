import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEW_REQUEST_WINDOW_DAYS,
  isValidGoogleReviewUrl,
  normalizeReviewEmail,
  reviewRequestBlockMessage,
  reviewRequestVerdict,
  type ReviewRequestBlockReason,
  type ReviewRequestCandidate,
} from "../lib/review-requests";

const VALID_URL = "https://search.google.com/local/writereview?placeid=TEST";
const NOW = new Date("2026-10-18T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function candidate(overrides: Partial<ReviewRequestCandidate> = {}): ReviewRequestCandidate {
  return {
    orderId: "ord_1",
    contactEmail: "sanne@example.com",
    isTest: false,
    businessOrderListId: null,
    deliveryMethod: "SHIPPING",
    status: "FULFILLED",
    deliveredAt: daysAgo(3),
    alreadySentAt: null,
    lastReviewMailToEmailAt: null,
    hasRefund: false,
    hasOpenCancellationRequest: false,
    ...overrides,
  };
}

function verdict(overrides: Partial<ReviewRequestCandidate> = {}, reviewUrl: string | null = VALID_URL) {
  return reviewRequestVerdict(candidate(overrides), { reviewUrl, now: NOW });
}

test("a delivered shipping order with nothing against it is eligible", () => {
  assert.deepEqual(verdict(), { eligible: true, warnings: [] });
});

test("a pickup order is eligible on the same rules", () => {
  assert.deepEqual(verdict({ deliveryMethod: "PICKUP" }), { eligible: true, warnings: [] });
});

test("a missing review url blocks every order", () => {
  for (const url of [null, "", "   "]) {
    const result = verdict({}, url);
    assert.equal(result.eligible, false);
    assert.equal(result.eligible === false && result.reason, "NO_REVIEW_URL");
  }
});

test("a review url that is not a bare writereview link blocks every order", () => {
  const result = verdict({}, "https://search.google.com/local/writereview?placeid=TEST&stars=5");
  assert.equal(result.eligible === false && result.reason, "NO_REVIEW_URL");
});

test("test orders are blocked", () => {
  const result = verdict({ isTest: true });
  assert.equal(result.eligible === false && result.reason, "TEST_ORDER");
});

test("business orders are blocked", () => {
  const result = verdict({ businessOrderListId: "bol_1" });
  assert.equal(result.eligible === false && result.reason, "BUSINESS_ORDER");
});

test("an order that is not delivered yet is blocked", () => {
  const result = verdict({ deliveredAt: null });
  assert.equal(result.eligible === false && result.reason, "NOT_DELIVERED_YET");
});

test("an order that already got a review mail is blocked", () => {
  const result = verdict({ alreadySentAt: daysAgo(1) });
  assert.equal(result.eligible === false && result.reason, "ALREADY_SENT_FOR_ORDER");
});

test("a guest asked 100 days ago on the same address is blocked, 200 days ago is not", () => {
  const recent = verdict({ lastReviewMailToEmailAt: daysAgo(100) });
  assert.equal(recent.eligible === false && recent.reason, "WITHIN_FREQUENCY_WINDOW");
  assert.equal(verdict({ lastReviewMailToEmailAt: daysAgo(200) }).eligible, true);
});

test("the frequency window is exactly six months", () => {
  assert.equal(REVIEW_REQUEST_WINDOW_DAYS, 183);
  assert.equal(verdict({ lastReviewMailToEmailAt: daysAgo(182) }).eligible, false);
  assert.equal(verdict({ lastReviewMailToEmailAt: daysAgo(184) }).eligible, true);
});

test("email matching ignores case and surrounding spaces", () => {
  assert.equal(normalizeReviewEmail(" Sanne@Example.COM "), "sanne@example.com");
  assert.equal(normalizeReviewEmail("sanne@example.com"), "sanne@example.com");
});

test("refunded, cancelled and disputed orders stay eligible but carry a warning", () => {
  assert.deepEqual(verdict({ hasRefund: true }), { eligible: true, warnings: ["REFUNDED"] });
  assert.deepEqual(verdict({ status: "REFUNDED" }), { eligible: true, warnings: ["REFUNDED"] });
  assert.deepEqual(verdict({ status: "CANCELLED" }), { eligible: true, warnings: ["CANCELLED"] });
  assert.deepEqual(verdict({ hasOpenCancellationRequest: true }), { eligible: true, warnings: ["DISPUTED"] });
});

test("warnings are reported alongside a block, not swallowed by it", () => {
  const result = verdict({ hasRefund: true, alreadySentAt: daysAgo(1) });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.warnings, ["REFUNDED"]);
});

test("a missing review url outranks every other block", () => {
  const result = verdict({ isTest: true, businessOrderListId: "bol_1", deliveredAt: null }, null);
  assert.equal(result.eligible === false && result.reason, "NO_REVIEW_URL");
});

test("every blocking reason has Dutch wording", () => {
  const reasons: ReviewRequestBlockReason[] = [
    "NO_REVIEW_URL",
    "BUSINESS_ORDER",
    "TEST_ORDER",
    "NOT_DELIVERED_YET",
    "ALREADY_SENT_FOR_ORDER",
    "WITHIN_FREQUENCY_WINDOW",
  ];
  for (const reason of reasons) {
    const message = reviewRequestBlockMessage(reason);
    assert.ok(message.length > 0, `${reason} has no message`);
    assert.ok(/[a-z]/.test(message), `${reason} message looks like a code, not a sentence`);
  }
});

test("only a bare writereview url with a placeid is accepted", () => {
  assert.ok(isValidGoogleReviewUrl(VALID_URL));
  assert.ok(isValidGoogleReviewUrl(" https://search.google.com/local/writereview?placeid=ABC "));
  assert.ok(!isValidGoogleReviewUrl("https://search.google.com/local/writereview?placeid=ABC&stars=5"));
  assert.ok(!isValidGoogleReviewUrl("https://search.google.com/local/writereview"));
  assert.ok(!isValidGoogleReviewUrl("https://search.google.com/local/writereview?placeid="));
  assert.ok(!isValidGoogleReviewUrl("https://g.page/r/ABC/review"));
  assert.ok(!isValidGoogleReviewUrl("http://search.google.com/local/writereview?placeid=ABC"));
  assert.ok(!isValidGoogleReviewUrl("not a url"));
  assert.ok(!isValidGoogleReviewUrl(null));
  assert.ok(!isValidGoogleReviewUrl(""));
});
