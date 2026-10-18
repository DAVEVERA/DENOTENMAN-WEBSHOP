import "server-only";

import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { dispatchAftersalesEvent } from "@/lib/aftersales/service";
import {
  REVIEW_URL_SETTING_KEY,
  normalizeReviewEmail,
  reviewRequestOutcome,
  reviewRequestVerdict,
  type ReviewRequestBlockReason,
  type ReviewRequestCandidate,
  type ReviewRequestVerdict,
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
  const reviewUrl = await getSetting(REVIEW_URL_SETTING_KEY);
  return { candidate, verdict: reviewRequestVerdict(candidate, { reviewUrl, now: new Date() }) };
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
    create: { orderId, stepId, trigger: "REVIEW_REQUEST", status: "SKIPPED", errorMessage: reason },
    update: { status: "SKIPPED", errorMessage: reason },
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
