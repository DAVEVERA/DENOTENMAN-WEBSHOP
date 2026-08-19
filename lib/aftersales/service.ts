import "server-only";
import {
  EmailDeliveryKind,
  Prisma,
  type AftersalesTrigger,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAftersalesContent } from "@/lib/aftersales/schema";
import { renderAftersalesEmail } from "@/lib/aftersales/template";
import {
  deliverTransactionalEmail,
  retryTransactionalEmail,
  type TransactionalEmailResult,
} from "@/lib/transactional-email";
import { isAftersalesSchemaUnavailable } from "@/lib/aftersales/database";

const FALLBACK_STEP_IDS: Record<AftersalesTrigger, string> = {
  ORDER_PAID: "order-paid-email",
  ORDER_FULFILLED: "order-fulfilled-email",
};

const MAX_DELIVERY_ATTEMPTS = 5;

export type PreparedAftersalesEvent = {
  stepId: string;
  usesFallback: boolean;
};

export type QueueAftersalesResult =
  | { status: "queued"; deliveryId: string }
  | { status: "duplicate"; deliveryId: string };

export type DispatchAftersalesResult =
  | { status: "disabled" | "no-step" | "duplicate" }
  | { status: "sent"; deliveryId: string; provider: string }
  | { status: "failed"; deliveryId: string; error: string };

/**
 * Resolve the configured step before the order transaction starts. When an
 * active flow has no enabled step, use the seeded default template as the
 * safe fallback instead of silently dropping the transactional event.
 */
export async function prepareAftersalesEvent(
  trigger: AftersalesTrigger
): Promise<PreparedAftersalesEvent | null> {
  try {
    const activeFlow = await prisma.aftersalesFlow.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      include: {
        steps: {
          where: { trigger, enabled: true, delayMinutes: 0 },
          orderBy: { position: "asc" },
          take: 1,
        },
      },
    });
    const activeStep = activeFlow?.steps[0];
    if (activeStep) return { stepId: activeStep.id, usesFallback: false };

    const fallback = await prisma.aftersalesStep.findUnique({
      where: { id: FALLBACK_STEP_IDS[trigger] },
      select: { id: true },
    });
    return fallback ? { stepId: fallback.id, usesFallback: true } : null;
  } catch (error) {
    if (isAftersalesSchemaUnavailable(error)) return null;
    throw error;
  }
}

/**
 * Must be called from the same transaction that changes the order status.
 * This is the durable outbox write: either both records commit, or neither
 * does, so a process crash cannot lose the e-mail event.
 */
export async function queueAftersalesEvent(
  transaction: Prisma.TransactionClient,
  orderId: string,
  trigger: AftersalesTrigger,
  prepared: PreparedAftersalesEvent
): Promise<QueueAftersalesResult> {
  try {
    const delivery = await transaction.aftersalesDelivery.create({
      data: {
        orderId,
        stepId: prepared.stepId,
        trigger,
        status: "PENDING",
        errorMessage: prepared.usesFallback ? "SYSTEM_FALLBACK_TEMPLATE" : null,
      },
      select: { id: true },
    });
    return { status: "queued", deliveryId: delivery.id };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const existing = await transaction.aftersalesDelivery.findFirstOrThrow({
      where: { orderId, stepId: prepared.stepId, trigger },
      select: { id: true },
    });
    return { status: "duplicate", deliveryId: existing.id };
  }
}

async function markDeliverySent(
  deliveryId: string,
  provider: string,
  providerMessageId: string | null
): Promise<DispatchAftersalesResult> {
  await prisma.aftersalesDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "SENT",
      provider,
      providerMessageId,
      sentAt: new Date(),
      errorMessage: null,
    },
  });
  return { status: "sent", deliveryId, provider };
}

async function markDeliveryFailed(
  deliveryId: string,
  error: string
): Promise<DispatchAftersalesResult> {
  await prisma.aftersalesDelivery.update({
    where: { id: deliveryId },
    data: { status: "FAILED", errorMessage: error.slice(0, 1000) },
  });
  return { status: "failed", deliveryId, error };
}

async function interpretTransactionalResult(
  deliveryId: string,
  result: TransactionalEmailResult
): Promise<DispatchAftersalesResult> {
  if (result.status === "accepted") {
    return markDeliverySent(deliveryId, result.provider, result.providerMessageId);
  }
  if (result.status === "failed") {
    return markDeliveryFailed(deliveryId, `${result.code}: ${result.error}`);
  }

  if (result.deliveryStatus === "ACCEPTED") {
    const log = await prisma.emailDeliveryLog.findUnique({
      where: { id: result.logId },
      select: { provider: true, providerMessageId: true },
    });
    return markDeliverySent(
      deliveryId,
      log?.provider ?? "UNKNOWN",
      log?.providerMessageId ?? null
    );
  }
  if (result.deliveryStatus === "FAILED") {
    const log = await prisma.emailDeliveryLog.findUnique({
      where: { id: result.logId },
      select: { errorCode: true, errorMessage: true },
    });
    const message = [log?.errorCode, log?.errorMessage].filter(Boolean).join(": ");
    return markDeliveryFailed(deliveryId, message || "Transactionele e-mail is mislukt");
  }

  // Another request already owns this idempotency key and is still sending.
  return { status: "duplicate" };
}

export async function processAftersalesDelivery(
  deliveryId: string
): Promise<DispatchAftersalesResult> {
  const delivery = await prisma.aftersalesDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      step: true,
      order: { include: { items: true } },
    },
  });
  if (!delivery) throw new Error(`Aftersales-opdracht ${deliveryId} bestaat niet`);
  if (delivery.status === "SENT" || delivery.status === "SKIPPED") {
    return { status: "duplicate" };
  }
  if (delivery.attempts >= MAX_DELIVERY_ATTEMPTS) {
    return {
      status: "failed",
      deliveryId,
      error: `Maximaal ${MAX_DELIVERY_ATTEMPTS} verzendpogingen bereikt`,
    };
  }

  await prisma.aftersalesDelivery.update({
    where: { id: delivery.id },
    data: { status: "PENDING", attempts: { increment: 1 }, errorMessage: null },
  });

  try {
    const content = parseAftersalesContent(delivery.step.content);
    const locale =
      delivery.order.locale === "en" || delivery.order.locale === "fr"
        ? delivery.order.locale
        : "nl";
    const rendered = renderAftersalesEmail(
      delivery.order,
      delivery.trigger,
      content[locale]
    );
    const idempotencyKey = `aftersales-${delivery.id}`;
    const existingLog = await prisma.emailDeliveryLog.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    });
    const result = existingLog?.status === "FAILED"
      ? await retryTransactionalEmail(existingLog.id)
      : await deliverTransactionalEmail({
          idempotencyKey,
          kind:
            delivery.trigger === "ORDER_PAID"
              ? EmailDeliveryKind.ORDER_CONFIRMATION
              : EmailDeliveryKind.ORDER_FULFILLED,
          recipientEmail: delivery.order.contactEmail,
          recipientName: delivery.order.contactName,
          orderId: delivery.orderId,
          trigger: delivery.trigger,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
    return await interpretTransactionalResult(delivery.id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende verzendfout";
    console.error("Aftersales mail failed", {
      orderId: delivery.orderId,
      trigger: delivery.trigger,
      deliveryId: delivery.id,
      error,
    });
    return markDeliveryFailed(delivery.id, message);
  }
}

export async function processPendingAftersalesForOrder(
  orderId: string
): Promise<DispatchAftersalesResult[]> {
  let deliveries;
  try {
    deliveries = await prisma.aftersalesDelivery.findMany({
      where: {
        orderId,
        status: { in: ["PENDING", "FAILED"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  } catch (error) {
    if (isAftersalesSchemaUnavailable(error)) return [];
    throw error;
  }

  const results: DispatchAftersalesResult[] = [];
  for (const delivery of deliveries) {
    results.push(await processAftersalesDelivery(delivery.id));
  }
  return results;
}

export async function dispatchAftersalesEvent(
  orderId: string,
  trigger: AftersalesTrigger
): Promise<DispatchAftersalesResult> {
  const prepared = await prepareAftersalesEvent(trigger);
  if (!prepared) return { status: "disabled" };

  const queued = await prisma.$transaction((transaction) =>
    queueAftersalesEvent(transaction, orderId, trigger, prepared)
  );
  return processAftersalesDelivery(queued.deliveryId);
}

/** Keep AftersalesDelivery aligned when an administrator retries a log entry. */
export async function reconcileAftersalesDeliveryForEmailLog(
  logId: string
): Promise<void> {
  const log = await prisma.emailDeliveryLog.findUnique({
    where: { id: logId },
    select: {
      idempotencyKey: true,
      status: true,
      provider: true,
      providerMessageId: true,
      acceptedAt: true,
      errorCode: true,
      errorMessage: true,
    },
  });
  if (!log?.idempotencyKey.startsWith("aftersales-")) return;

  const deliveryId = log.idempotencyKey.slice("aftersales-".length);
  const logStatus = String(log.status);
  const deliveryStatus =
    logStatus === "ACCEPTED" || logStatus === "DELIVERED"
      ? "SENT"
      : logStatus === "PENDING"
        ? "PENDING"
        : "FAILED";
  try {
    await prisma.aftersalesDelivery.updateMany({
      where: { id: deliveryId },
      data: {
        status: deliveryStatus,
        provider: log.provider,
        providerMessageId: log.providerMessageId,
        sentAt: deliveryStatus === "SENT" ? log.acceptedAt ?? new Date() : null,
        errorMessage:
          deliveryStatus === "FAILED"
            ? [log.errorCode, log.errorMessage].filter(Boolean).join(": ").slice(0, 1000)
            : null,
      },
    });
  } catch (error) {
    if (isAftersalesSchemaUnavailable(error)) return;
    throw error;
  }
}
