import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEW_WORKLIST_MIN_AGE_DAYS,
  REVIEW_WORKLIST_WINDOW_DAYS,
  reviewConversionByWeek,
  selectReviewWorklist,
  type ReviewRequestCandidate,
} from "../lib/review-requests";

const VALID_URL = "https://search.google.com/local/writereview?placeid=TEST";
const now = new Date("2026-10-18T12:00:00Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

function candidate(overrides: Partial<ReviewRequestCandidate> = {}): ReviewRequestCandidate {
  return {
    orderId: "ord_1",
    contactEmail: "sanne@example.com",
    isTest: false,
    businessOrderListId: null,
    deliveryMethod: "SHIPPING",
    status: "FULFILLED",
    deliveredAt: days(3),
    alreadySentAt: null,
    lastReviewMailToEmailAt: null,
    hasRefund: false,
    hasOpenCancellationRequest: false,
    ...overrides,
  };
}

test("the worklist constants match the spec", () => {
  assert.equal(REVIEW_WORKLIST_MIN_AGE_DAYS, 2);
  assert.equal(REVIEW_WORKLIST_WINDOW_DAYS, 30);
});

test("the worklist drops orders younger than two days", () => {
  const { rows } = selectReviewWorklist(
    [
      candidate({ orderId: "fresh", deliveredAt: days(1) }),
      candidate({ orderId: "ripe", deliveredAt: days(3) }),
    ],
    { reviewUrl: VALID_URL, now }
  );
  assert.deepEqual(rows.map((row) => row.candidate.orderId), ["ripe"]);
});

test("the worklist hides orders outside the window but counts them", () => {
  const { rows, outsideWindow } = selectReviewWorklist([candidate({ deliveredAt: days(40) })], {
    reviewUrl: VALID_URL,
    now,
  });
  assert.equal(rows.length, 0);
  assert.equal(outsideWindow, 1);
});

test("an order too young to ask is not counted as being outside the window", () => {
  const { rows, outsideWindow } = selectReviewWorklist([candidate({ deliveredAt: days(1) })], {
    reviewUrl: VALID_URL,
    now,
  });
  assert.equal(rows.length, 0);
  assert.equal(outsideWindow, 0);
});

test("the worklist drops blocked orders and keeps warned ones with their warning", () => {
  const { rows } = selectReviewWorklist(
    [
      candidate({ orderId: "business", businessOrderListId: "bol_1" }),
      candidate({ orderId: "test", isTest: true }),
      candidate({ orderId: "asked", lastReviewMailToEmailAt: days(10) }),
      candidate({ orderId: "refunded", hasRefund: true }),
    ],
    { reviewUrl: VALID_URL, now }
  );
  assert.deepEqual(rows.map((row) => row.candidate.orderId), ["refunded"]);
  assert.deepEqual(rows[0].warnings, ["REFUNDED"]);
});

test("without a review url the worklist is empty rather than misleading", () => {
  const { rows } = selectReviewWorklist([candidate()], { reviewUrl: null, now });
  assert.equal(rows.length, 0);
});

test("the worklist puts the oldest order first", () => {
  const { rows } = selectReviewWorklist(
    [
      candidate({ orderId: "newer", deliveredAt: days(3) }),
      candidate({ orderId: "older", deliveredAt: days(9) }),
    ],
    { reviewUrl: VALID_URL, now }
  );
  assert.deepEqual(rows.map((row) => row.candidate.orderId), ["older", "newer"]);
});

test("conversion by week reports null instead of dividing by zero", () => {
  const weeks = reviewConversionByWeek({
    sent: [],
    snapshots: [
      { capturedOn: new Date("2026-10-12T00:00:00Z"), reviewCount: 100 },
      { capturedOn: new Date("2026-10-18T00:00:00Z"), reviewCount: 104 },
    ],
  });
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].weekStart, "2026-10-12");
  assert.equal(weeks[0].sent, 0);
  assert.equal(weeks[0].newReviews, 4);
  assert.equal(weeks[0].rate, null);
});

test("conversion by week needs two snapshots before it reports new reviews", () => {
  const weeks = reviewConversionByWeek({
    sent: [{ sentAt: new Date("2026-10-13T09:00:00Z") }],
    snapshots: [{ capturedOn: new Date("2026-10-13T00:00:00Z"), reviewCount: 100 }],
  });
  assert.equal(weeks[0].newReviews, 0);
  assert.equal(weeks[0].rate, 0);
});

test("conversion by week counts the review delta within each week", () => {
  const weeks = reviewConversionByWeek({
    sent: [{ sentAt: new Date("2026-10-13T09:00:00Z") }, { sentAt: new Date("2026-10-14T09:00:00Z") }],
    snapshots: [
      { capturedOn: new Date("2026-10-12T00:00:00Z"), reviewCount: 100 },
      { capturedOn: new Date("2026-10-18T00:00:00Z"), reviewCount: 101 },
    ],
  });
  assert.equal(weeks[0].sent, 2);
  assert.equal(weeks[0].newReviews, 1);
  assert.equal(weeks[0].rate, 0.5);
});

test("conversion by week is empty when there is nothing at all", () => {
  assert.deepEqual(reviewConversionByWeek({ sent: [], snapshots: [] }), []);
});

test("conversion by week lists weeks oldest first and never reports a negative delta", () => {
  const weeks = reviewConversionByWeek({
    sent: [{ sentAt: new Date("2026-10-07T09:00:00Z") }],
    snapshots: [
      { capturedOn: new Date("2026-10-05T00:00:00Z"), reviewCount: 100 },
      { capturedOn: new Date("2026-10-11T00:00:00Z"), reviewCount: 98 },
      { capturedOn: new Date("2026-10-12T00:00:00Z"), reviewCount: 99 },
      { capturedOn: new Date("2026-10-18T00:00:00Z"), reviewCount: 105 },
    ],
  });
  assert.deepEqual(weeks.map((week) => week.weekStart), ["2026-10-05", "2026-10-12"]);
  // A review can be removed by its author, so a week can lose reviews; that is
  // reported as zero gained rather than as a negative conversion.
  assert.equal(weeks[0].newReviews, 0);
  assert.equal(weeks[1].newReviews, 6);
});
