import "server-only";

import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { publicOrderNumber } from "@/lib/order-reference";
import { latestRating } from "@/lib/google-reviews";
import { dispatchAftersalesEvent } from "@/lib/aftersales/service";
import {
  REVIEW_URL_SETTING_KEY,
  REVIEW_WORKLIST_WINDOW_DAYS,
  normalizeReviewEmail,
  reviewConversionByWeek,
  reviewRequestBlockMessage,
  reviewRequestOutcome,
  reviewRequestVerdict,
  selectReviewWorklist,
  type ReviewConversionWeek,
  type ReviewRequestBlockReason,
  type ReviewRequestCandidate,
  type ReviewRequestVerdict,
  type ReviewRequestWarning,
} from "@/lib/review-requests";

/** A refund that exists or is on its way; a failed or cancelled one is not one. */
const ACTIVE_REFUND_STATUSES = ["CREATING", "QUEUED", "PENDING", "PROCESSING", "REFUNDED"] as const;

/**
 * Deliveries that count as "this address has been asked". A bounce or a
 * rejection means the customer never saw it, so it must not burn their
 * six-month window.
 */
const ASKED_EMAIL_STATUSES = ["PENDING", "ACCEPTED", "DELIVERED", "COMPLAINED", "SUPPRESSED"] as const;

export type SendReviewRequestResult =
  | { status: "sent" }
  | { status: "skipped"; reason: ReviewRequestBlockReason }
  | { status: "failed"; error: string };

/**
 * Builds the candidate the pure rules in lib/review-requests.ts judge.
 *
 * `deliveredAt` is `Order.processedAt`: the shop's own "verwerkt" tick, which
 * means shipped for a shipping order and handed over for a pickup order. It is
 * the only moment in the data that says the order left the shop. For shipping
 * orders the parcel is then still in transit, which is exactly why the worklist
 * additionally requires the order to be a couple of days old.
 */
export async function loadReviewRequestCandidate(
  orderId: string
): Promise<ReviewRequestCandidate | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      contactEmail: true,
      isTest: true,
      businessOrderListId: true,
      deliveryMethod: true,
      status: true,
      processedAt: true,
      refunds: {
        where: { status: { in: [...ACTIVE_REFUND_STATUSES] } },
        select: { id: true },
        take: 1,
      },
      businessCancellationRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
      aftersalesDeliveries: {
        where: { trigger: "REVIEW_REQUEST", status: "SENT" },
        select: { sentAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!order) return null;

  const lastAsked = await prisma.emailDeliveryLog.findFirst({
    where: {
      kind: "REVIEW_REQUEST",
      recipientEmail: { equals: normalizeReviewEmail(order.contactEmail), mode: "insensitive" },
      status: { in: [...ASKED_EMAIL_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    orderId: order.id,
    contactEmail: order.contactEmail,
    isTest: order.isTest,
    businessOrderListId: order.businessOrderListId,
    deliveryMethod: order.deliveryMethod,
    status: order.status,
    deliveredAt: order.processedAt,
    alreadySentAt: order.aftersalesDeliveries[0]?.sentAt ?? null,
    lastReviewMailToEmailAt: lastAsked?.createdAt ?? null,
    hasRefund: order.refunds.length > 0,
    hasOpenCancellationRequest: order.businessCancellationRequests.length > 0,
  };
}

export async function reviewRequestVerdictForOrder(
  orderId: string
): Promise<{ candidate: ReviewRequestCandidate; verdict: ReviewRequestVerdict } | null> {
  const candidate = await loadReviewRequestCandidate(orderId);
  if (!candidate) return null;
  const [reviewUrl, stepId] = await Promise.all([
    getSetting(REVIEW_URL_SETTING_KEY),
    activeReviewStepId(),
  ]);
  const verdict = reviewRequestVerdict(candidate, { reviewUrl, now: new Date() });
  // Without an enabled step nothing can be sent. Saying so up front beats a red
  // error on every click with no hint about what to switch on.
  if (verdict.eligible && !stepId) {
    return { candidate, verdict: { eligible: false, reason: "NO_STEP", warnings: verdict.warnings } };
  }
  return { candidate, verdict };
}

/** The enabled review step on the active particuliere flow, if there is one. */
async function activeReviewStepId(): Promise<string | null> {
  const flow = await prisma.aftersalesFlow.findFirst({
    where: { isActive: true, flowType: "PARTICULIER" },
    orderBy: { updatedAt: "desc" },
    select: {
      steps: {
        where: { trigger: "REVIEW_REQUEST", enabled: true },
        orderBy: { position: "asc" },
        select: { id: true },
        take: 1,
      },
    },
  });
  return flow?.steps[0]?.id ?? null;
}

/**
 * Writes the "deliberately not mailed" row the admin sees in the delivery list.
 * Without a configured step there is nothing to hang it on, which is harmless:
 * the caller still reports the skip.
 */
async function recordReviewRequestSkip(
  orderId: string,
  reason: ReviewRequestBlockReason
): Promise<void> {
  const stepId = await activeReviewStepId();
  if (!stepId) return;
  await prisma.aftersalesDelivery.upsert({
    where: { orderId_stepId_trigger: { orderId, stepId, trigger: "REVIEW_REQUEST" } },
    // The flow editor renders errorMessage straight to the admin, so this holds
    // the Dutch sentence, not the reason code.
    create: {
      orderId,
      stepId,
      trigger: "REVIEW_REQUEST",
      status: "SKIPPED",
      errorMessage: reviewRequestBlockMessage(reason),
    },
    update: { status: "SKIPPED", errorMessage: reviewRequestBlockMessage(reason) },
  });
}

/**
 * A row left by an earlier skip would make the delivery permanently
 * unsendable, because the unique key is (order, step, trigger) and a SKIPPED
 * delivery short-circuits as a duplicate. Once the rules do allow the mail,
 * the row is handed back to the outbox instead of blocking it forever.
 */
async function reopenSkippedDelivery(orderId: string): Promise<void> {
  await prisma.aftersalesDelivery.updateMany({
    where: { orderId, trigger: "REVIEW_REQUEST", status: "SKIPPED" },
    data: { status: "PENDING", attempts: 0, errorMessage: null },
  });
}

export async function sendReviewRequest(orderId: string): Promise<SendReviewRequestResult> {
  const resolved = await reviewRequestVerdictForOrder(orderId);
  if (!resolved) return { status: "failed", error: "Deze bestelling bestaat niet." };

  const outcome = reviewRequestOutcome(resolved.verdict);
  if (outcome.action === "refuse") return { status: "skipped", reason: outcome.reason };
  if (outcome.action === "skip") {
    await recordReviewRequestSkip(orderId, outcome.reason);
    return { status: "skipped", reason: outcome.reason };
  }

  await reopenSkippedDelivery(orderId);
  const result = await dispatchAftersalesEvent(orderId, "REVIEW_REQUEST");
  if (result.status === "sent") return { status: "sent" };
  if (result.status === "failed") return { status: "failed", error: result.error };
  if (result.status === "duplicate") {
    return { status: "failed", error: "Er loopt al een verzending voor deze bestelling." };
  }
  return {
    status: "failed",
    error: "De reviewstap staat niet aan in de aftersales-flow, dus er is niets verstuurd.",
  };
}

export type ReviewWorklistEntry = {
  orderId: string;
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  deliveredAt: Date;
  deliveryMethod: "SHIPPING" | "PICKUP";
  warnings: ReviewRequestWarning[];
};

/**
 * Every order that may be asked right now, oldest first.
 *
 * Two queries, never one per order: the candidate orders, then the review mails
 * already sent to those addresses. Business and test orders are filtered in the
 * query as well as by the rules, so they never travel further than they must.
 */
export async function loadReviewWorklist(now: Date): Promise<{
  entries: ReviewWorklistEntry[];
  withWarnings: number;
}> {
  const reviewUrl = await getSetting(REVIEW_URL_SETTING_KEY);
  // Bounded on purpose. This runs on the admin dashboard, so an unbounded scan
  // over the whole order history would grow with the order book on every page
  // view. Only orders young enough to appear in the list are loaded; the count
  // of older ones comes from countReviewWorklistOutsideWindow.
  const windowStart = new Date(now.getTime() - REVIEW_WORKLIST_WINDOW_DAYS * 86_400_000);
  const orders = await prisma.order.findMany({
    where: {
      isTest: false,
      businessOrderListId: null,
      processedAt: { not: null, gte: windowStart },
    },
    orderBy: { processedAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      contactName: true,
      contactEmail: true,
      isTest: true,
      businessOrderListId: true,
      deliveryMethod: true,
      status: true,
      processedAt: true,
      refunds: {
        where: { status: { in: [...ACTIVE_REFUND_STATUSES] } },
        select: { id: true },
        take: 1,
      },
      businessCancellationRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
      aftersalesDeliveries: {
        where: { trigger: "REVIEW_REQUEST", status: "SENT" },
        select: { sentAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (orders.length === 0) return { entries: [], withWarnings: 0 };

  const addresses = [...new Set(orders.map((order) => normalizeReviewEmail(order.contactEmail)))];
  const logs = await prisma.emailDeliveryLog.findMany({
    where: {
      kind: "REVIEW_REQUEST",
      status: { in: [...ASKED_EMAIL_STATUSES] },
      // Already-lowercase on write (lib/transactional-email.ts), and `mode` does
      // not apply to `in`, so claiming insensitivity here would be a fiction.
      recipientEmail: { in: addresses },
    },
    orderBy: { createdAt: "desc" },
    select: { recipientEmail: true, createdAt: true },
  });
  const lastAskedByEmail = new Map<string, Date>();
  for (const log of logs) {
    const key = normalizeReviewEmail(log.recipientEmail);
    if (!lastAskedByEmail.has(key)) lastAskedByEmail.set(key, log.createdAt);
  }

  const display = new Map(orders.map((order) => [order.id, order]));
  const candidates: ReviewRequestCandidate[] = orders.map((order) => ({
    orderId: order.id,
    contactEmail: order.contactEmail,
    isTest: order.isTest,
    businessOrderListId: order.businessOrderListId,
    deliveryMethod: order.deliveryMethod,
    status: order.status,
    deliveredAt: order.processedAt,
    alreadySentAt: order.aftersalesDeliveries[0]?.sentAt ?? null,
    lastReviewMailToEmailAt: lastAskedByEmail.get(normalizeReviewEmail(order.contactEmail)) ?? null,
    hasRefund: order.refunds.length > 0,
    hasOpenCancellationRequest: order.businessCancellationRequests.length > 0,
  }));

  const worklist = selectReviewWorklist(candidates, { reviewUrl, now });
  const entries = worklist.rows.flatMap((row) => {
    const order = display.get(row.candidate.orderId);
    if (!order?.processedAt) return [];
    return [
      {
        orderId: order.id,
        orderNumber: publicOrderNumber(order),
        contactName: order.contactName,
        contactEmail: order.contactEmail,
        deliveredAt: order.processedAt,
        deliveryMethod: order.deliveryMethod,
        warnings: row.warnings,
      },
    ];
  });

  return { entries, withWarnings: worklist.withWarnings };
}

/**
 * How many eligible-looking orders sit just outside the worklist window. A
 * single count, and only the marketing page asks for it: on day one the whole
 * order history qualifies, and sending all of it at once would burn the
 * six-month limit for most customers on the same day.
 */
export async function countReviewWorklistOutsideWindow(now: Date): Promise<number> {
  const windowStart = new Date(now.getTime() - REVIEW_WORKLIST_WINDOW_DAYS * 86_400_000);
  return prisma.order.count({
    where: {
      isTest: false,
      businessOrderListId: null,
      processedAt: { not: null, lt: windowStart },
      aftersalesDeliveries: { none: { trigger: "REVIEW_REQUEST", status: "SENT" } },
    },
  });
}

export type ReviewAnalysis = {
  weeks: ReviewConversionWeek[];
  ratingSeries: Array<{ capturedOn: Date; rating: number; reviewCount: number }>;
  latest: { rating: number; reviewCount: number } | null;
};

/** Everything the analysis block on the marketing page shows. */
export async function loadReviewAnalysis(now: Date): Promise<ReviewAnalysis> {
  const since = new Date(now.getTime() - 120 * 86_400_000);
  const [sent, snapshots] = await Promise.all([
    prisma.aftersalesDelivery.findMany({
      where: { trigger: "REVIEW_REQUEST", status: "SENT", sentAt: { not: null, gte: since } },
      select: { sentAt: true },
    }),
    prisma.googleReviewSnapshot.findMany({
      where: { capturedOn: { gte: since } },
      orderBy: { capturedOn: "asc" },
      select: { capturedOn: true, rating: true, reviewCount: true },
    }),
  ]);

  return {
    weeks: reviewConversionByWeek({
      sent: sent.flatMap((delivery) => (delivery.sentAt ? [{ sentAt: delivery.sentAt }] : [])),
      snapshots,
    }),
    ratingSeries: snapshots,
    // Ordered ascending by the query, so the newest point is the last one.
    latest: snapshots.at(-1) ?? null,
  };
}

export type ReviewDashboardNumbers = {
  rating: number | null;
  reviewCount: number | null;
  mailsSent: number;
  pending: number;
};

/** The three numbers the dashboard widgets show. */
export async function loadReviewDashboardNumbers(now: Date): Promise<ReviewDashboardNumbers> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [snapshots, mailsSent, worklist] = await Promise.all([
    prisma.googleReviewSnapshot.findMany({
      orderBy: { capturedOn: "desc" },
      take: 1,
      select: { capturedOn: true, rating: true, reviewCount: true },
    }),
    prisma.aftersalesDelivery.count({
      where: { trigger: "REVIEW_REQUEST", status: "SENT", sentAt: { gte: since } },
    }),
    loadReviewWorklist(now),
  ]);

  const latest = latestRating(snapshots);
  return {
    rating: latest?.rating ?? null,
    reviewCount: latest?.reviewCount ?? null,
    mailsSent,
    pending: worklist.entries.length,
  };
}
