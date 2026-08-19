import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { EmailDeliveryEventType, EmailDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TRACKED_EVENTS = {
  delivered: "DELIVERED",
  hard_bounce: "BOUNCED",
  soft_bounce: "BOUNCED",
  spam: "COMPLAINED",
  reject: "REJECTED",
  unsub: "SUPPRESSED",
} as const satisfies Record<string, EmailDeliveryEventType>;

type TrackedProviderEvent = keyof typeof TRACKED_EVENTS;

type MandrillWebhookEvent = {
  event?: unknown;
  ts?: unknown;
  _id?: unknown;
  msg?: {
    _id?: unknown;
    state?: unknown;
    reject_reason?: unknown;
  };
};

export type NormalizedDeliveryEvent = {
  providerEventId: string;
  providerMessageId: string;
  type: EmailDeliveryEventType;
  providerEvent: TrackedProviderEvent;
  reasonCode: string | null;
  occurredAt: Date;
};

type ProviderEventTransaction = {
  emailDeliveryEvent: {
    createMany(args: { data: Array<Record<string, unknown>>; skipDuplicates: boolean }): Promise<{ count: number }>;
  };
  emailDeliveryLog: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
};

type ProviderEventDatabase = {
  emailDeliveryLog: {
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; providerMessageId: string | null }>>;
  };
  $transaction<T>(callback: (transaction: ProviderEventTransaction) => Promise<T>): Promise<T>;
};

function signatureInput(url: string, params: URLSearchParams): string {
  const entries = Array.from(params.entries()).sort(([left], [right]) => left.localeCompare(right));
  return entries.reduce((signed, [key, value]) => `${signed}${key}${value}`, url);
}

export function createMandrillSignature(
  webhookKey: string,
  webhookUrl: string,
  params: URLSearchParams
): string {
  return createHmac("sha1", webhookKey)
    .update(signatureInput(webhookUrl, params))
    .digest("base64");
}

export function verifyMandrillSignature(input: {
  webhookKey: string;
  webhookUrl: string;
  params: URLSearchParams;
  signature: string | null;
}): boolean {
  if (!input.signature) return false;

  const expected = Buffer.from(
    createMandrillSignature(input.webhookKey, input.webhookUrl, input.params),
    "utf8"
  );
  const received = Buffer.from(input.signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function boundedReasonCode(event: MandrillWebhookEvent): string | null {
  const candidate = event.msg?.reject_reason ?? event.msg?.state;
  if (typeof candidate !== "string") return null;

  const normalized = candidate
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return normalized || null;
}

function normalizeEvent(event: MandrillWebhookEvent): NormalizedDeliveryEvent | null {
  const providerEvent = typeof event.event === "string" ? event.event : "";
  if (!(providerEvent in TRACKED_EVENTS)) return null;

  const providerMessageId = String(event._id ?? event.msg?._id ?? "").trim();
  const timestamp = typeof event.ts === "number" ? event.ts : Number(event.ts);
  if (!providerMessageId || !Number.isInteger(timestamp) || timestamp <= 0) return null;

  const occurredAt = new Date(timestamp * 1000);
  if (Number.isNaN(occurredAt.getTime())) return null;

  const reasonCode = boundedReasonCode(event);
  const providerEventId = createHash("sha256")
    .update(
      [providerMessageId, providerEvent, String(timestamp), reasonCode ?? ""].join("\u0000")
    )
    .digest("hex");

  return {
    providerEventId,
    providerMessageId,
    type: TRACKED_EVENTS[providerEvent as TrackedProviderEvent],
    providerEvent: providerEvent as TrackedProviderEvent,
    reasonCode,
    occurredAt,
  };
}

export function parseMandrillEvents(raw: string): {
  tracked: NormalizedDeliveryEvent[];
  ignored: number;
} {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 1000) {
    throw new Error("mandrill_events moet een array van maximaal 1000 events zijn");
  }

  const tracked: NormalizedDeliveryEvent[] = [];
  let ignored = 0;
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object") {
      ignored += 1;
      continue;
    }
    const normalized = normalizeEvent(candidate as MandrillWebhookEvent);
    if (normalized) tracked.push(normalized);
    else ignored += 1;
  }
  return { tracked, ignored };
}

const ALLOWED_CURRENT_STATUSES: Record<EmailDeliveryEventType, EmailDeliveryStatus[]> = {
  DELIVERED: ["PENDING", "ACCEPTED", "FAILED"],
  BOUNCED: ["PENDING", "ACCEPTED", "DELIVERED", "FAILED", "REJECTED"],
  COMPLAINED: ["PENDING", "ACCEPTED", "DELIVERED", "BOUNCED", "FAILED", "REJECTED"],
  REJECTED: ["PENDING", "ACCEPTED", "FAILED"],
  SUPPRESSED: ["PENDING", "ACCEPTED", "DELIVERED", "BOUNCED", "FAILED", "REJECTED"],
};

function timestampUpdate(event: NormalizedDeliveryEvent): {
  deliveredAt?: Date;
  bouncedAt?: Date;
  complainedAt?: Date;
} {
  if (event.type === "DELIVERED") return { deliveredAt: event.occurredAt };
  if (event.type === "BOUNCED") return { bouncedAt: event.occurredAt };
  if (event.type === "COMPLAINED") return { complainedAt: event.occurredAt };
  return {};
}

export async function recordMandrillDeliveryEvents(
  events: NormalizedDeliveryEvent[],
  database: ProviderEventDatabase = prisma as unknown as ProviderEventDatabase
): Promise<{
  recorded: number;
  duplicates: number;
  unmatched: number;
}> {
  if (events.length === 0) return { recorded: 0, duplicates: 0, unmatched: 0 };

  const messageIds = Array.from(new Set(events.map((event) => event.providerMessageId)));
  const deliveries = await database.emailDeliveryLog.findMany({
    where: {
      provider: "MAILCHIMP_TRANSACTIONAL",
      providerMessageId: { in: messageIds },
    },
    select: { id: true, providerMessageId: true },
  });
  const deliveryByMessageId = new Map(
    deliveries.flatMap((delivery) =>
      delivery.providerMessageId ? [[delivery.providerMessageId, delivery.id] as const] : []
    )
  );

  const matched = events.flatMap((event) => {
    const deliveryId = deliveryByMessageId.get(event.providerMessageId);
    return deliveryId ? [{ event, deliveryId }] : [];
  });
  const unmatched = events.length - matched.length;
  if (matched.length === 0) return { recorded: 0, duplicates: 0, unmatched };

  const result = await database.$transaction(async (transaction) => {
    const inserted = await transaction.emailDeliveryEvent.createMany({
      data: matched.map(({ event, deliveryId }) => ({
        providerEventId: event.providerEventId,
        deliveryId,
        provider: "MAILCHIMP_TRANSACTIONAL",
        providerMessageId: event.providerMessageId,
        type: event.type,
        providerEvent: event.providerEvent,
        reasonCode: event.reasonCode,
        occurredAt: event.occurredAt,
      })),
      skipDuplicates: true,
    });

    const ordered = [...matched].sort((left, right) =>
      left.event.occurredAt.getTime() - right.event.occurredAt.getTime()
    );
    for (const { event, deliveryId } of ordered) {
      await transaction.emailDeliveryLog.updateMany({
        where: {
          id: deliveryId,
          status: { in: ALLOWED_CURRENT_STATUSES[event.type] },
          OR: [
            { lastProviderEventAt: null },
            { lastProviderEventAt: { lte: event.occurredAt } },
          ],
        },
        data: {
          status: event.type,
          providerStatus: event.providerEvent,
          lastProviderEventAt: event.occurredAt,
          ...timestampUpdate(event),
        },
      });
    }

    return inserted.count;
  });

  return {
    recorded: result,
    duplicates: matched.length - result,
    unmatched,
  };
}
