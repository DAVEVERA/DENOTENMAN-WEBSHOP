/**
 * Rules for the manually sent review request mail.
 *
 * Deliberately free of Prisma and `server-only`: the selection rules decide who
 * does and does not get asked for a public Google review, which is exactly the
 * logic that has to be testable without a database. The Prisma queries that
 * build a candidate live in lib/review-requests-db.ts.
 */

/** Six months. A customer who was asked is left alone for this long. */
export const REVIEW_REQUEST_WINDOW_DAYS = 183;

export const REVIEW_URL_SETTING_KEY = "reviews.googleReviewUrl";

const DAY_MS = 86_400_000;

export type ReviewRequestBlockReason =
  | "NO_REVIEW_URL"
  | "BUSINESS_ORDER"
  | "TEST_ORDER"
  | "NOT_DELIVERED_YET"
  | "ALREADY_SENT_FOR_ORDER"
  | "WITHIN_FREQUENCY_WINDOW"
  /** The review step is not switched on in the aftersales flow. */
  | "NO_STEP";

/**
 * Reasons to look twice before asking, but never reasons to refuse: a human
 * presses the button, so the call is theirs.
 */
export type ReviewRequestWarning = "REFUNDED" | "CANCELLED" | "DISPUTED";

export type ReviewRequestCandidate = {
  orderId: string;
  contactEmail: string;
  isTest: boolean;
  businessOrderListId: string | null;
  deliveryMethod: "SHIPPING" | "PICKUP";
  status: "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
  /**
   * When the order reached the customer: the moment a shipping order was
   * marked done, or a pickup order was handed over. Null means it has not.
   */
  deliveredAt: Date | null;
  /** A review mail already went out for this order. */
  alreadySentAt: Date | null;
  /** The most recent review mail to this e-mail address, across all orders. */
  lastReviewMailToEmailAt: Date | null;
  hasRefund: boolean;
  hasOpenCancellationRequest: boolean;
};

export type ReviewRequestVerdict =
  | { eligible: true; warnings: ReviewRequestWarning[] }
  | { eligible: false; reason: ReviewRequestBlockReason; warnings: ReviewRequestWarning[] };

/** The frequency window keys on the address on the order, so guests count too. */
export function normalizeReviewEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Google accepts no pre-filled rating and breaks on extra query parameters, so
 * the only link worth storing is a bare writereview URL with a place id.
 */
export function isValidGoogleReviewUrl(value: string | null): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "search.google.com") return false;
  if (url.pathname !== "/local/writereview") return false;
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== "placeid") return false;
  return (url.searchParams.get("placeid") ?? "").length > 0;
}

/**
 * The review mail is the only flow mail whose button leaves the shop, so it is
 * the only one that overrides the action url. An unusable link yields no
 * override at all, which keeps the mail off the wire instead of shipping a
 * button that goes nowhere.
 */
export function reviewActionUrlOverrideFor(trigger: string, reviewUrl: string | null): string | null {
  if (trigger !== "REVIEW_REQUEST") return null;
  return isValidGoogleReviewUrl(reviewUrl) ? reviewUrl!.trim() : null;
}

export type ReviewRequestAction =
  | { action: "send" }
  | { action: "skip"; reason: ReviewRequestBlockReason }
  | { action: "refuse"; reason: ReviewRequestBlockReason };

/**
 * Splits a verdict into what the send path should actually do. The two
 * frequency blocks leave a SKIPPED row behind so the admin can see the shop
 * deliberately did not mail this customer; every other block is a refusal that
 * should not litter the delivery log.
 */
export function reviewRequestOutcome(verdict: ReviewRequestVerdict): ReviewRequestAction {
  if (verdict.eligible) return { action: "send" };
  const recordsSkip =
    verdict.reason === "WITHIN_FREQUENCY_WINDOW" || verdict.reason === "ALREADY_SENT_FOR_ORDER";
  return recordsSkip
    ? { action: "skip", reason: verdict.reason }
    : { action: "refuse", reason: verdict.reason };
}

function warningsFor(candidate: ReviewRequestCandidate): ReviewRequestWarning[] {
  const warnings: ReviewRequestWarning[] = [];
  if (candidate.hasRefund || candidate.status === "REFUNDED") warnings.push("REFUNDED");
  if (candidate.status === "CANCELLED") warnings.push("CANCELLED");
  if (candidate.hasOpenCancellationRequest) warnings.push("DISPUTED");
  return warnings;
}

function daysSince(moment: Date, now: Date): number {
  return (now.getTime() - moment.getTime()) / DAY_MS;
}

export function reviewRequestVerdict(
  candidate: ReviewRequestCandidate,
  context: { reviewUrl: string | null; now: Date }
): ReviewRequestVerdict {
  // Warnings are computed even when blocked, so the admin sees both at once.
  const warnings = warningsFor(candidate);
  const blocked = (reason: ReviewRequestBlockReason): ReviewRequestVerdict => ({
    eligible: false,
    reason,
    warnings,
  });

  // A mail with a dead button is worse than no mail, so this outranks the rest.
  if (!isValidGoogleReviewUrl(context.reviewUrl)) return blocked("NO_REVIEW_URL");
  if (candidate.isTest) return blocked("TEST_ORDER");
  if (candidate.businessOrderListId !== null) return blocked("BUSINESS_ORDER");
  if (!candidate.deliveredAt) return blocked("NOT_DELIVERED_YET");
  if (candidate.alreadySentAt) return blocked("ALREADY_SENT_FOR_ORDER");
  if (
    candidate.lastReviewMailToEmailAt &&
    daysSince(candidate.lastReviewMailToEmailAt, context.now) < REVIEW_REQUEST_WINDOW_DAYS
  ) {
    return blocked("WITHIN_FREQUENCY_WINDOW");
  }

  return { eligible: true, warnings };
}

const BLOCK_MESSAGES: Record<ReviewRequestBlockReason, string> = {
  NO_REVIEW_URL: "Er is nog geen Google-reviewlink ingesteld.",
  BUSINESS_ORDER: "Zakelijke bestellingen krijgen geen reviewverzoek.",
  TEST_ORDER: "Dit is een testbestelling.",
  NOT_DELIVERED_YET: "Deze bestelling is nog niet bij de klant.",
  ALREADY_SENT_FOR_ORDER: "Voor deze bestelling is al een reviewverzoek verstuurd.",
  WITHIN_FREQUENCY_WINDOW: "Deze klant is de afgelopen zes maanden al gevraagd.",
  NO_STEP: "De reviewstap staat niet aan bij Marketing → Mail flows.",
};

export function reviewRequestBlockMessage(reason: ReviewRequestBlockReason): string {
  return BLOCK_MESSAGES[reason];
}

const WARNING_MESSAGES: Record<ReviewRequestWarning, string> = {
  REFUNDED: "Deze bestelling is (deels) terugbetaald.",
  CANCELLED: "Deze bestelling is geannuleerd.",
  DISPUTED: "Voor deze bestelling loopt een annuleringsverzoek.",
};

export function reviewRequestWarningMessage(warning: ReviewRequestWarning): string {
  return WARNING_MESSAGES[warning];
}

/** A shipping parcel is still in transit for a day or two after it goes out. */
export const REVIEW_WORKLIST_MIN_AGE_DAYS = 2;

/**
 * How far back the worklist looks by default. On the first day this feature is
 * live the whole order history would otherwise queue up, and asking all of it
 * at once burns the six-month window for most of the customer base on one day.
 */
export const REVIEW_WORKLIST_WINDOW_DAYS = 30;

export type ReviewWorklistRow = {
  candidate: ReviewRequestCandidate;
  warnings: ReviewRequestWarning[];
};

export type ReviewWorklist = {
  rows: ReviewWorklistRow[];
  /** Eligible, but older than the window: hidden, counted, never silently lost. */
  outsideWindow: number;
  /**
   * Eligible, but carrying a refund, cancellation or dispute. Withheld from the
   * list and counted, so the page can say so rather than losing them quietly.
   */
  withWarnings: number;
};

export function selectReviewWorklist(
  candidates: ReviewRequestCandidate[],
  context: { reviewUrl: string | null; now: Date }
): ReviewWorklist {
  const rows: ReviewWorklistRow[] = [];
  let outsideWindow = 0;
  let withWarnings = 0;

  for (const candidate of candidates) {
    const verdict = reviewRequestVerdict(candidate, context);
    if (!verdict.eligible) continue;
    const deliveredAt = candidate.deliveredAt;
    if (!deliveredAt) continue;

    const age = daysSince(deliveredAt, context.now);
    if (age < REVIEW_WORKLIST_MIN_AGE_DAYS) continue;
    if (age > REVIEW_WORKLIST_WINDOW_DAYS) {
      outsideWindow += 1;
      continue;
    }
    // A refund, cancellation or dispute keeps an order out of the list even
    // though the rules allow the mail: nobody should be asked for a public
    // review a day after getting their money back. The order page still offers
    // the send behind a warning, where a human is making the call.
    if (verdict.warnings.length > 0) {
      withWarnings += 1;
      continue;
    }
    rows.push({ candidate, warnings: verdict.warnings });
  }

  rows.sort(
    (left, right) =>
      (left.candidate.deliveredAt?.getTime() ?? 0) - (right.candidate.deliveredAt?.getTime() ?? 0)
  );
  return { rows, outsideWindow, withWarnings };
}

/** Monday-start week, in UTC, as a plain YYYY-MM-DD key. */
function weekStartKey(moment: Date): string {
  const date = new Date(
    Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate())
  );
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export type ReviewConversionWeek = {
  weekStart: string;
  sent: number;
  newReviews: number;
  /** Null when nothing was sent that week: there is no rate to report. */
  rate: number | null;
};

/**
 * Mails sent in a week against reviews gained in that same week.
 *
 * This is a relation at shop level, never an attribution per customer: the mail
 * sends people straight to Google, and a Google review carries no order number.
 * The page that shows this has to say so.
 */
export function reviewConversionByWeek(input: {
  sent: Array<{ sentAt: Date }>;
  snapshots: Array<{ capturedOn: Date; reviewCount: number }>;
}): ReviewConversionWeek[] {
  const sentByWeek = new Map<string, number>();
  for (const mail of input.sent) {
    const key = weekStartKey(mail.sentAt);
    sentByWeek.set(key, (sentByWeek.get(key) ?? 0) + 1);
  }

  const snapshotsByWeek = new Map<string, Array<{ capturedOn: Date; reviewCount: number }>>();
  for (const snapshot of input.snapshots) {
    const key = weekStartKey(snapshot.capturedOn);
    const bucket = snapshotsByWeek.get(key) ?? [];
    bucket.push(snapshot);
    snapshotsByWeek.set(key, bucket);
  }

  const ordered = [...input.snapshots].sort(
    (left, right) => left.capturedOn.getTime() - right.capturedOn.getTime()
  );

  const weeks = [...new Set([...sentByWeek.keys(), ...snapshotsByWeek.keys()])].sort();
  return weeks.map((weekStart) => {
    const sent = sentByWeek.get(weekStart) ?? 0;
    const bucket = [...(snapshotsByWeek.get(weekStart) ?? [])].sort(
      (left, right) => left.capturedOn.getTime() - right.capturedOn.getTime()
    );
    // Measure from the last snapshot BEFORE this week, not from its own first
    // one: with a daily snapshot, a Monday-to-Sunday window otherwise measures
    // six of the seven day-steps and the Sunday-to-Monday gain lands in no week
    // at all, biasing every week low.
    const weekStartMs = new Date(`${weekStart}T00:00:00Z`).getTime();
    const previous = [...ordered]
      .reverse()
      .find((snapshot) => snapshot.capturedOn.getTime() < weekStartMs);
    const last = bucket.at(-1);
    const baseline = previous ?? bucket[0];
    // An author can delete their own review, so a shrinking total is reported
    // as nothing gained rather than as a negative conversion.
    const newReviews =
      last && baseline ? Math.max(0, last.reviewCount - baseline.reviewCount) : 0;
    // With no earlier point and only one this week there is nothing to compare
    // against; "0%" would read as a verdict on the mail instead of a gap in the
    // measurements.
    const measurable = Boolean(last) && (Boolean(previous) || bucket.length >= 2);
    return {
      weekStart,
      sent,
      newReviews,
      rate: sent === 0 || !measurable ? null : newReviews / sent,
    };
  });
}
