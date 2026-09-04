import assert from "node:assert/strict";
import {
  calculateDiscount,
  calculateConfiguredDiscount,
  evaluateCheckoutDiscount,
  evaluateFirstOrderDiscount,
  hasDiscountCode,
  MARKET_DISCOUNT_CODES,
  resolveDiscountUsagePolicy,
  resolvePaymentDisposition,
} from "../lib/discounts";

assert.deepEqual(calculateDiscount(10_000, "marktactie10"), {
  code: "marktactie10",
  percent: 10,
  discountCents: 1_000,
});
assert.deepEqual(calculateDiscount(10_000, "rubensmarkt"), {
  code: "rubensmarkt",
  percent: 10,
  discountCents: 1_000,
});
assert.equal(calculateDiscount(999, "  RUBENSMARKT  ")?.discountCents, 100);
assert.equal(calculateDiscount(999, "  MARKTACTIE10  ")?.discountCents, 100);
assert.equal(calculateDiscount(10_000, "Rubensmarkt2026"), null);
assert.equal(calculateDiscount(10_000, "rubensmarkt,marktactie10"), null);
assert.equal(calculateDiscount(10_000, "rubensmarkt marktactie10"), null);
assert.equal(calculateDiscount(10_000, "verkeerd"), null);
assert.equal(calculateDiscount(10_000, ""), null);
assert.equal(hasDiscountCode("   "), false);
assert.equal(hasDiscountCode(MARKET_DISCOUNT_CODES[0]), true);

const activeFixedDiscount = {
  code: "ZOMER5",
  status: "ACTIVE" as const,
  percentOff: null,
  amountOffCents: 500,
  startsAt: null,
  endsAt: null,
};
assert.equal(
  calculateConfiguredDiscount(1_999, "ZOMER5", { ...activeFixedDiscount, minimumOrderCents: 2_000 }),
  null
);
assert.deepEqual(calculateConfiguredDiscount(2_000, " zomer5 ", activeFixedDiscount), {
  code: "ZOMER5",
  amountOffCents: 500,
  discountCents: 500,
});
assert.equal(
  calculateConfiguredDiscount(2_000, "ZOMER5", { ...activeFixedDiscount, status: "DRAFT" }),
  null
);
assert.deepEqual(
  calculateConfiguredDiscount(300, "ZOMER5", activeFixedDiscount),
  { code: "ZOMER5", amountOffCents: 500, discountCents: 300 }
);

const scheduledPercentDiscount = {
  code: "WEEKEND20",
  status: "SCHEDULED" as const,
  percentOff: 20,
  amountOffCents: null,
  startsAt: new Date("2026-08-17T00:00:00.000Z"),
  endsAt: new Date("2026-08-18T23:59:59.999Z"),
};
assert.deepEqual(
  calculateConfiguredDiscount(10_000, "WEEKEND20", { ...scheduledPercentDiscount, maximumDiscountCents: 1_250 }, new Date("2026-08-17T12:00:00.000Z")),
  { code: "WEEKEND20", percent: 20, discountCents: 1_250 }
);
assert.deepEqual(
  calculateConfiguredDiscount(
    10_000,
    "WEEKEND20",
    scheduledPercentDiscount,
    new Date("2026-08-17T12:00:00.000Z")
  ),
  { code: "WEEKEND20", percent: 20, discountCents: 2_000 }
);
assert.equal(
  calculateConfiguredDiscount(
    10_000,
    "WEEKEND20",
    scheduledPercentDiscount,
    new Date("2026-08-19T00:00:00.000Z")
  ),
  null
);

assert.deepEqual(evaluateFirstOrderDiscount(10_000, "marktactie10", false), {
  status: "applied",
  discount: {
    code: "marktactie10",
    percent: 10,
    discountCents: 1_000,
  },
});
assert.deepEqual(evaluateFirstOrderDiscount(10_000, "rubensmarkt", true), {
  status: "ineligible",
});
assert.deepEqual(evaluateFirstOrderDiscount(10_000, "onbekend", false), {
  status: "invalid",
});
assert.deepEqual(evaluateFirstOrderDiscount(10_000, "   ", true), {
  status: "none",
});

const testOrderCode = "dnm-test-a8F3qP7xL2";

assert.deepEqual(
  evaluateCheckoutDiscount(10_000, " dnm-test-a8F3qP7xL2 ", true, testOrderCode),
  {
    status: "applied",
    discount: {
      code: testOrderCode,
      percent: 100,
      discountCents: 10_000,
    },
    isTest: true,
  }
);
assert.deepEqual(
  evaluateCheckoutDiscount(10_000, "DNM-TEST-A8F3QP7XL2", false, testOrderCode),
  { status: "invalid" }
);
assert.deepEqual(
  evaluateCheckoutDiscount(10_000, "marktactie10", false, testOrderCode),
  {
    status: "applied",
    discount: {
      code: "marktactie10",
      percent: 10,
      discountCents: 1_000,
    },
    isTest: false,
  }
);
assert.deepEqual(
  evaluateCheckoutDiscount(2_000, "ZOMER5", true, testOrderCode, activeFixedDiscount),
  {
    status: "applied",
    discount: { code: "ZOMER5", amountOffCents: 500, discountCents: 500 },
    isTest: false,
  }
);
assert.equal(resolvePaymentDisposition(true, 0), "TEST_COMPLETE");
assert.equal(resolvePaymentDisposition(false, 0), "MOLLIE");
assert.equal(resolvePaymentDisposition(true, 1), "MOLLIE");

assert.deepEqual(resolveDiscountUsagePolicy("marktactie10"), {
  code: "marktactie10",
  identityScope: "EMAIL",
  maxUsesPerIdentity: 1,
});
assert.deepEqual(resolveDiscountUsagePolicy("SINGLE", {
  ...activeFixedDiscount,
  code: "SINGLE",
  redemptionMode: "SINGLE_USE",
  identityScope: "EMAIL_AND_CUSTOMER",
  maxUsesPerIdentity: 99,
}), {
  code: "SINGLE",
  identityScope: "EMAIL_AND_CUSTOMER",
  maxUsesPerIdentity: 1,
});
assert.deepEqual(resolveDiscountUsagePolicy("LOYAL", {
  ...activeFixedDiscount,
  code: "LOYAL",
  redemptionMode: "MULTIPLE_USE",
  identityScope: "CUSTOMER",
  maxUsesPerIdentity: 3,
}), {
  code: "LOYAL",
  identityScope: "CUSTOMER",
  maxUsesPerIdentity: 3,
});
assert.equal(resolveDiscountUsagePolicy("UNLIMITED", {
  ...activeFixedDiscount,
  code: "UNLIMITED",
  redemptionMode: "MULTIPLE_USE",
  maxUsesPerIdentity: null,
}).maxUsesPerIdentity, null);

console.log("discount tests passed");
