import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderTimeline } from "../lib/order-timeline";

const BASE_ORDER = {
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:00:00Z"),
  paidAt: null as Date | null,
  status: "PENDING",
  emailDeliveryLogs: [],
  refunds: [],
  businessCancellationRequests: [],
};

test("always includes the order-placed event first when nothing else happened yet", () => {
  const events = buildOrderTimeline(BASE_ORDER);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "ORDER_PLACED");
  assert.equal(events[0].label, "Bestelling geplaatst");
});

test("adds a payment-received event and sorts events chronologically", () => {
  const events = buildOrderTimeline({
    ...BASE_ORDER,
    status: "PAID",
    paidAt: new Date("2026-01-02T09:00:00Z"),
  });

  assert.deepEqual(
    events.map((event) => event.kind),
    ["ORDER_PLACED", "PAYMENT_RECEIVED"]
  );
  assert.ok(events[0].at.getTime() < events[1].at.getTime());
});

test("labels email delivery logs with a Dutch kind and status description", () => {
  const events = buildOrderTimeline({
    ...BASE_ORDER,
    emailDeliveryLogs: [
      {
        kind: "ORDER_CONFIRMATION",
        status: "DELIVERED",
        createdAt: new Date("2026-01-01T10:05:00Z"),
        deliveredAt: new Date("2026-01-01T10:06:00Z"),
      },
    ],
  });

  const emailEvent = events.find((event) => event.kind === "EMAIL");
  assert.ok(emailEvent);
  assert.equal(emailEvent.label, "E-mail Orderbevestiging — afgeleverd");
  assert.equal(emailEvent.at.toISOString(), "2026-01-01T10:06:00.000Z");
});

test("adds one event for a requested refund and a second only once it reaches a terminal status", () => {
  const pendingEvents = buildOrderTimeline({
    ...BASE_ORDER,
    refunds: [
      {
        status: "PROCESSING",
        amountCents: 1500,
        createdAt: new Date("2026-01-03T00:00:00Z"),
        updatedAt: new Date("2026-01-03T01:00:00Z"),
      },
    ],
  });
  assert.equal(pendingEvents.filter((event) => event.kind === "REFUND").length, 1);

  const resolvedEvents = buildOrderTimeline({
    ...BASE_ORDER,
    refunds: [
      {
        status: "REFUNDED",
        amountCents: 1500,
        createdAt: new Date("2026-01-03T00:00:00Z"),
        updatedAt: new Date("2026-01-03T01:00:00Z"),
      },
    ],
  });
  const refundEvents = resolvedEvents.filter((event) => event.kind === "REFUND");
  assert.equal(refundEvents.length, 2);
  assert.match(refundEvents[0].label, /aangevraagd/);
  assert.match(refundEvents[1].label, /voltooid/);
});

test("adds a cancellation-request event, and a resolution event once resolved", () => {
  const events = buildOrderTimeline({
    ...BASE_ORDER,
    businessCancellationRequests: [
      {
        status: "PROCESSED",
        createdAt: new Date("2026-01-04T00:00:00Z"),
        updatedAt: new Date("2026-01-04T02:00:00Z"),
      },
    ],
  });
  const cancellationEvents = events.filter((event) => event.kind === "CANCELLATION_REQUEST");
  assert.equal(cancellationEvents.length, 2);
  assert.equal(cancellationEvents[0].label, "Annuleringsverzoek ontvangen");
  assert.equal(cancellationEvents[1].label, "Annuleringsverzoek verwerkt");
});

test("marks a notable status change (fulfilled/cancelled/refunded) but not plain paid/pending", () => {
  const fulfilled = buildOrderTimeline({ ...BASE_ORDER, status: "FULFILLED" });
  assert.ok(fulfilled.some((event) => event.kind === "STATUS_CHANGED"));

  const pending = buildOrderTimeline({ ...BASE_ORDER, status: "PENDING" });
  assert.ok(!pending.some((event) => event.kind === "STATUS_CHANGED"));
});
