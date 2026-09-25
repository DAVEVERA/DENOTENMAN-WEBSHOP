import { formatPrice } from "@/lib/format";

// Pure, framework-free timeline builder for the admin order detail page.
// No new data model: every event here comes from fields/relations that are
// already part of the Order query in app/admin/(dashboard)/bestellingen/[id]/page.tsx.

export type OrderTimelineEventKind =
  | "ORDER_PLACED"
  | "PAYMENT_RECEIVED"
  | "STATUS_CHANGED"
  | "EMAIL"
  | "REFUND"
  | "CANCELLATION_REQUEST";

export type OrderTimelineEvent = {
  at: Date;
  kind: OrderTimelineEventKind;
  label: string;
};

const EMAIL_KIND_LABELS: Record<string, string> = {
  ORDER_CONFIRMATION: "Orderbevestiging",
  ORDER_FULFILLED: "Verzendbevestiging",
  NEW_ORDER_NOTIFICATION: "Interne bestelmelding",
  AFTERSALES_TEST: "Testmail",
  BACK_IN_STOCK: "Weer-op-voorraad-melding",
  BUSINESS_ORDER_LIST: "Zakelijke orderlijst",
  BUSINESS_INVITATION: "Zakelijke uitnodiging",
  BUSINESS_ORDER_LIST_CHANGED: "Wijziging orderlijst",
  BUSINESS_INVOICE: "Factuur",
  BUSINESS_PRICE_REQUESTED: "Prijsopgave",
  NOOTPLAN_EMAIL_VERIFICATION: "Nootplan e-mailverificatie",
  NOOTPLAN_PASSWORD_RESET: "Nootplan wachtwoordherstel",
  NOOTPLAN_SUBSCRIPTION_CONFIRMATION: "Nootplan bevestiging",
  NOOTPLAN_UPCOMING_PAYMENT: "Nootplan betalingsherinnering",
};

const EMAIL_STATUS_LABELS: Record<string, string> = {
  PENDING: "in wachtrij",
  ACCEPTED: "geaccepteerd door mailserver",
  DELIVERED: "afgeleverd",
  BOUNCED: "gebounced",
  COMPLAINED: "gemarkeerd als spam",
  REJECTED: "geweigerd",
  SUPPRESSED: "onderdrukt",
  FAILED: "mislukt",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Openstaand",
  PAID: "Betaald",
  FULFILLED: "Verzonden",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  REFUNDED: "voltooid",
  FAILED: "mislukt",
  CANCELED: "geannuleerd",
};

// Only these refund statuses are worth a separate timeline entry — the
// in-flight statuses (CREATING/QUEUED/PENDING/PROCESSING) are noise between
// "aangevraagd" and a resolved outcome.
const REFUND_TERMINAL_STATUSES = new Set(["REFUNDED", "FAILED", "CANCELED"]);

const CANCELLATION_STATUS_LABELS: Record<string, string> = {
  PROCESSED: "verwerkt",
  REJECTED: "afgewezen",
};

// Order-level states worth their own marker beyond "betaald" (already
// covered by paidAt) — the moment the order left the normal PAID flow.
const NOTABLE_ORDER_STATUSES = new Set(["CANCELLED", "FULFILLED", "REFUNDED"]);

export type TimelineEmailLog = {
  kind: string;
  status: string;
  createdAt: Date;
  deliveredAt: Date | null;
};

export type TimelineRefund = {
  status: string;
  amountCents: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TimelineCancellationRequest = {
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TimelineOrderInput = {
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  status: string;
  emailDeliveryLogs: TimelineEmailLog[];
  refunds: TimelineRefund[];
  businessCancellationRequests: TimelineCancellationRequest[];
};

export function buildOrderTimeline(order: TimelineOrderInput): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];

  events.push({ at: order.createdAt, kind: "ORDER_PLACED", label: "Bestelling geplaatst" });

  if (order.paidAt) {
    events.push({ at: order.paidAt, kind: "PAYMENT_RECEIVED", label: "Betaling ontvangen" });
  }

  for (const log of order.emailDeliveryLogs) {
    const kindLabel = EMAIL_KIND_LABELS[log.kind] ?? log.kind;
    const statusLabel = EMAIL_STATUS_LABELS[log.status] ?? log.status.toLowerCase();
    events.push({
      at: log.deliveredAt ?? log.createdAt,
      kind: "EMAIL",
      label: `E-mail ${kindLabel} — ${statusLabel}`,
    });
  }

  for (const refund of order.refunds) {
    events.push({
      at: refund.createdAt,
      kind: "REFUND",
      label: `Terugbetaling aangevraagd (${formatPrice(refund.amountCents, "nl")})`,
    });
    if (
      REFUND_TERMINAL_STATUSES.has(refund.status) &&
      refund.updatedAt.getTime() !== refund.createdAt.getTime()
    ) {
      events.push({
        at: refund.updatedAt,
        kind: "REFUND",
        label: `Terugbetaling ${REFUND_STATUS_LABELS[refund.status] ?? refund.status.toLowerCase()}`,
      });
    }
  }

  for (const request of order.businessCancellationRequests) {
    events.push({
      at: request.createdAt,
      kind: "CANCELLATION_REQUEST",
      label: "Annuleringsverzoek ontvangen",
    });
    const resolvedLabel = CANCELLATION_STATUS_LABELS[request.status];
    if (resolvedLabel && request.updatedAt.getTime() !== request.createdAt.getTime()) {
      events.push({
        at: request.updatedAt,
        kind: "CANCELLATION_REQUEST",
        label: `Annuleringsverzoek ${resolvedLabel}`,
      });
    }
  }

  if (NOTABLE_ORDER_STATUSES.has(order.status)) {
    events.push({
      at: order.updatedAt,
      kind: "STATUS_CHANGED",
      label: `Bestelling gemarkeerd als ${ORDER_STATUS_LABELS[order.status] ?? order.status}`,
    });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
