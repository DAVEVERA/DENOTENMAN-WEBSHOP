import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  aftersalesEmailDeliveryKind,
  prepareAftersalesEvent,
  queueAftersalesEvent,
  reconcileAftersalesDeliveryForEmailLog,
} from "../lib/aftersales/service";

test("paid aftersales triggers use the order-confirmation delivery kind", () => {
  assert.equal(aftersalesEmailDeliveryKind("ORDER_PAID"), "ORDER_CONFIRMATION");
  assert.equal(aftersalesEmailDeliveryKind("BUSINESS_ORDER_PAID"), "ORDER_CONFIRMATION");
  assert.equal(aftersalesEmailDeliveryKind("ORDER_FULFILLED"), "ORDER_FULFILLED");
  assert.equal(aftersalesEmailDeliveryKind("BUSINESS_ORDER_FULFILLED"), "ORDER_FULFILLED");
});

test("disabled active step resolves to the seeded transactional fallback", async () => {
  const flowDelegate = prisma.aftersalesFlow as unknown as {
    findFirst: (...args: unknown[]) => unknown;
  };
  const stepDelegate = prisma.aftersalesStep as unknown as {
    findUnique: (...args: unknown[]) => unknown;
  };
  const originalFindFlow = flowDelegate.findFirst;
  const originalFindStep = stepDelegate.findUnique;
  flowDelegate.findFirst = async () => ({
    id: "active-flow",
    name: "Actief",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [],
  });
  stepDelegate.findUnique = async () => ({ id: "order-fulfilled-email" });

  try {
    assert.deepEqual(await prepareAftersalesEvent("ORDER_FULFILLED"), {
      stepId: "order-fulfilled-email",
      usesFallback: true,
    });
  } finally {
    flowDelegate.findFirst = originalFindFlow;
    stepDelegate.findUnique = originalFindStep;
  }
});

test("prepareAftersalesEvent resolves the ZAKELIJK flow for a business trigger even when a PARTICULIER flow was edited more recently", async () => {
  const flowDelegate = prisma.aftersalesFlow as unknown as { findFirst: (...args: unknown[]) => unknown };
  const original = flowDelegate.findFirst;
  let capturedWhere: unknown;
  flowDelegate.findFirst = async (...args: unknown[]) => {
    capturedWhere = (args[0] as { where: unknown }).where;
    return {
      id: "zakelijk-flow",
      name: "Zakelijk",
      isActive: true,
      flowType: "ZAKELIJK",
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [{ id: "business-order-paid-step" }],
    };
  };
  try {
    const result = await prepareAftersalesEvent("BUSINESS_ORDER_PAID");
    assert.deepEqual(result, { stepId: "business-order-paid-step", usesFallback: false });
    assert.deepEqual(capturedWhere, { isActive: true, flowType: "ZAKELIJK" });
  } finally {
    flowDelegate.findFirst = original;
  }
});

test("queue writes a pending outbox record through the supplied transaction", async () => {
  let capturedData: unknown;
  const transaction = {
    aftersalesDelivery: {
      create: async ({ data }: { data: unknown }) => {
        capturedData = data;
        return { id: "delivery-1" };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await queueAftersalesEvent(
    transaction,
    "order-1",
    "ORDER_PAID",
    { stepId: "order-paid-email", usesFallback: false }
  );

  assert.deepEqual(result, { status: "queued", deliveryId: "delivery-1" });
  assert.deepEqual(capturedData, {
    orderId: "order-1",
    stepId: "order-paid-email",
    trigger: "ORDER_PAID",
    status: "PENDING",
    errorMessage: null,
  });
});

test("accepted log retry reconciles the related outbox record", async () => {
  const logDelegate = prisma.emailDeliveryLog as unknown as {
    findUnique: (...args: unknown[]) => unknown;
  };
  const deliveryDelegate = prisma.aftersalesDelivery as unknown as {
    updateMany: (...args: unknown[]) => unknown;
  };
  const originalFindLog = logDelegate.findUnique;
  const originalUpdateDelivery = deliveryDelegate.updateMany;
  let updateInput: unknown;
  logDelegate.findUnique = async () => ({
    idempotencyKey: "aftersales-delivery-42",
    status: "ACCEPTED",
    provider: "MAILCHIMP_TRANSACTIONAL",
    providerMessageId: "message-42",
    acceptedAt: new Date("2026-08-19T18:00:00.000Z"),
    errorCode: null,
    errorMessage: null,
  });
  deliveryDelegate.updateMany = async (input: unknown) => {
    updateInput = input;
    return { count: 1 };
  };

  try {
    await reconcileAftersalesDeliveryForEmailLog("log-42");
    assert.deepEqual(updateInput, {
      where: { id: "delivery-42" },
      data: {
        status: "SENT",
        provider: "MAILCHIMP_TRANSACTIONAL",
        providerMessageId: "message-42",
        sentAt: new Date("2026-08-19T18:00:00.000Z"),
        errorMessage: null,
      },
    });
  } finally {
    logDelegate.findUnique = originalFindLog;
    deliveryDelegate.updateMany = originalUpdateDelivery;
  }
});
