import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { getEnabledGenericStepContent } from "../lib/aftersales/service";
import { defaultAftersalesDesign } from "../lib/aftersales/schema";
import { sendBackInStockEmail } from "../lib/mail";

test("an explicitly disabled stock step never falls back to sending a stock email", async () => {
  const original = prisma.aftersalesFlow.findFirst;
  const originalLog = prisma.emailDeliveryLog.findUnique;
  let logReads = 0;
  const locale = { subject: "Stock", previewText: "Stock", heading: "Stock", body: "Stock", buttonLabel: "View" };
  prisma.aftersalesFlow.findFirst = (async () => ({
    logoUrl: null,
    steps: [{ enabled: false, content: { locales: { nl: locale, en: locale, fr: locale }, design: defaultAftersalesDesign } }],
  })) as unknown as typeof original;
  prisma.emailDeliveryLog.findUnique = (async () => { logReads++; return null; }) as unknown as typeof originalLog;
  try {
    assert.deepEqual(await getEnabledGenericStepContent("BACK_IN_STOCK"), { disabled: true });
    assert.equal(await sendBackInStockEmail({ notificationId: "disabled-stock", email: "qa@example.invalid", locale: "nl", productName: "QA product", productUrl: "http://localhost:3105/nl/products/qa" }), false);
    assert.equal(logReads, 0, "disabled stock mail must not enter the delivery pipeline");
  } finally {
    prisma.aftersalesFlow.findFirst = original;
    prisma.emailDeliveryLog.findUnique = originalLog;
  }
});

test("an absent active flow keeps the legacy stock-template fallback", async () => {
  const original = prisma.aftersalesFlow.findFirst;
  prisma.aftersalesFlow.findFirst = (async () => null) as typeof original;
  try { assert.equal(await getEnabledGenericStepContent("BACK_IN_STOCK"), null); }
  finally { prisma.aftersalesFlow.findFirst = original; }
});
