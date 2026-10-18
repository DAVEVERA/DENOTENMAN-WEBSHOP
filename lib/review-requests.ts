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
  | "WITHIN_FREQUENCY_WINDOW";

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
