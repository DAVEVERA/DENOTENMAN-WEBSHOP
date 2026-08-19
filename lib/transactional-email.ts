import "server-only";
import {
  EmailDeliveryKind,
  EmailDeliveryStatus,
  Prisma,
  type AftersalesTrigger,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  aftersalesProviderStatus,
  checkTransactionalProviderReadiness,
  sendAftersalesMail,
  TransactionalProviderError,
} from "@/lib/aftersales/provider";

const transactionalEmailInputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  kind: z.nativeEnum(EmailDeliveryKind),
  recipientEmail: z.string().trim().email().max(320),
  recipientName: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(1).max(998),
  html: z.string().min(1).max(500_000),
  text: z.string().min(1).max(200_000),
  orderId: z.string().trim().min(1).max(100).optional(),
  trigger: z.enum(["ORDER_PAID", "ORDER_FULFILLED"]).optional(),
}).strict();

export type TransactionalEmailInput = z.infer<typeof transactionalEmailInputSchema>;

export type TransactionalEmailResult =
  | {
      status: "accepted";
      logId: string;
      provider: string;
      providerMessageId: string;
    }
  | {
      status: "duplicate" | "pending";
      logId: string;
      deliveryStatus: EmailDeliveryStatus;
    }
  | { status: "failed"; logId: string; code: string; error: string };

const ORDER_RECIPIENT_KINDS = new Set<EmailDeliveryKind>([
  EmailDeliveryKind.ORDER_CONFIRMATION,
  EmailDeliveryKind.ORDER_FULFILLED,
]);

export function normalizeRecipientEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function requiresCurrentOrderRecipient(kind: EmailDeliveryKind): boolean {
  return ORDER_RECIPIENT_KINDS.has(kind);
}

async function assertCorrectOrderRecipient(input: TransactionalEmailInput): Promise<void> {
  if (!requiresCurrentOrderRecipient(input.kind)) return;
  if (!input.orderId) {
    throw new TransactionalProviderError(
      "Een bestelmail moet aan een bestelling gekoppeld zijn",
      "ORDER_REQUIRED",
      false
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { contactEmail: true },
  });
  if (!order) {
    throw new TransactionalProviderError(
      `Bestelling ${input.orderId} bestaat niet`,
      "ORDER_NOT_FOUND",
      false
    );
  }
  if (normalizeRecipientEmail(order.contactEmail) !== normalizeRecipientEmail(input.recipientEmail)) {
    throw new TransactionalProviderError(
      "De ontvanger komt niet overeen met het actuele e-mailadres van de bestelling",
      "RECIPIENT_MISMATCH",
      false
    );
  }
}

function providerName(): string {
  const provider = aftersalesProviderStatus().provider;
  if (provider === "mailchimp") return "MAILCHIMP_TRANSACTIONAL";
  if (provider === "resend") return "RESEND_FALLBACK";
  return "NONE";
}

function failure(error: unknown): { code: string; message: string } {
  if (error instanceof TransactionalProviderError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "UNKNOWN_PROVIDER_ERROR",
    message: error instanceof Error ? error.message : "Onbekende verzendfout",
  };
}

async function attemptExistingDelivery(
  logId: string,
  input: TransactionalEmailInput
): Promise<TransactionalEmailResult> {
  const provider = providerName();
  const attemptNumber = await prisma.emailDeliveryAttempt.count({ where: { deliveryId: logId } }) + 1;
  const attempt = await prisma.emailDeliveryAttempt.create({
    data: { deliveryId: logId, attemptNumber, provider, status: "STARTED" },
  });
  await prisma.emailDeliveryLog.update({
    where: { id: logId },
    data: {
      status: "PENDING",
      provider,
      lastAttemptAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  });

  try {
    await assertCorrectOrderRecipient(input);
    const readiness = await checkTransactionalProviderReadiness();
    if (!readiness.ready) {
      const code = readiness.provider === "none"
        ? "TRANSACTIONAL_PROVIDER_NOT_CONFIGURED"
        : "PROVIDER_NOT_READY";
      throw new TransactionalProviderError(
        readiness.message,
        code,
        false
      );
    }
    const result = await sendAftersalesMail({
      deliveryId: logId,
      orderId: input.orderId ?? "",
      trigger: input.trigger ?? input.kind,
      to: normalizeRecipientEmail(input.recipientEmail),
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    const acceptedAt = new Date();
    await prisma.$transaction([
      prisma.emailDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "ACCEPTED",
          providerMessageId: result.messageId,
          providerStatus: result.providerStatus,
          completedAt: acceptedAt,
        },
      }),
      prisma.emailDeliveryLog.update({
        where: { id: logId },
        data: {
          status: "ACCEPTED",
          provider: result.provider,
          providerMessageId: result.messageId,
          providerStatus: result.providerStatus,
          acceptedAt,
          errorCode: null,
          errorMessage: null,
        },
      }),
    ]);
    return {
      status: "accepted",
      logId,
      provider: result.provider,
      providerMessageId: result.messageId,
    };
  } catch (error) {
    const normalized = failure(error);
    const completedAt = new Date();
    await prisma.$transaction([
      prisma.emailDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          errorCode: normalized.code,
          errorMessage: normalized.message.slice(0, 2000),
          completedAt,
        },
      }),
      prisma.emailDeliveryLog.update({
        where: { id: logId },
        data: {
          status: "FAILED",
          errorCode: normalized.code,
          errorMessage: normalized.message.slice(0, 2000),
        },
      }),
    ]);
    return { status: "failed", logId, code: normalized.code, error: normalized.message };
  }
}

export async function deliverTransactionalEmail(
  candidate: TransactionalEmailInput
): Promise<TransactionalEmailResult> {
  const input = transactionalEmailInputSchema.parse(candidate);
  let log;
  try {
    log = await prisma.emailDeliveryLog.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        recipientEmail: normalizeRecipientEmail(input.recipientEmail),
        recipientName: input.recipientName,
        subject: input.subject,
        htmlBody: input.html,
        textBody: input.text,
        orderId: input.orderId,
        trigger: input.trigger as AftersalesTrigger | undefined,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const existing = await prisma.emailDeliveryLog.findUniqueOrThrow({
      where: { idempotencyKey: input.idempotencyKey },
    });
    return {
      status: existing.status === "PENDING" ? "pending" : "duplicate",
      logId: existing.id,
      deliveryStatus: existing.status,
    };
  }

  return attemptExistingDelivery(log.id, input);
}

export async function retryTransactionalEmail(logId: string): Promise<TransactionalEmailResult> {
  const existing = await prisma.emailDeliveryLog.findUnique({ where: { id: logId } });
  if (!existing) throw new Error("EMAIL_LOG_NOT_FOUND");
  if (existing.status !== "FAILED") {
    return {
      status: existing.status === "PENDING" ? "pending" : "duplicate",
      logId: existing.id,
      deliveryStatus: existing.status,
    };
  }

  const claimed = await prisma.emailDeliveryLog.updateMany({
    where: { id: existing.id, status: "FAILED" },
    data: { status: "PENDING" },
  });
  if (claimed.count !== 1) {
    const current = await prisma.emailDeliveryLog.findUniqueOrThrow({ where: { id: existing.id } });
    return { status: "pending", logId: current.id, deliveryStatus: current.status };
  }

  return attemptExistingDelivery(existing.id, {
    idempotencyKey: existing.idempotencyKey,
    kind: existing.kind,
    recipientEmail: existing.recipientEmail,
    recipientName: existing.recipientName ?? undefined,
    subject: existing.subject,
    html: existing.htmlBody,
    text: existing.textBody,
    orderId: existing.orderId ?? undefined,
    trigger: existing.trigger ?? undefined,
  });
}
