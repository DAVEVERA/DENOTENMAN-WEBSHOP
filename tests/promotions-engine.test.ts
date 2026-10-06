import assert from "node:assert/strict";
import test from "node:test";

import {
  amsterdamClock,
  bestPrice,
  countdownText,
  isPromotionLive,
  priceCartWithPromotions,
  productPromotionView,
  ruleFromRow,
  tierFor,
  type CartLineFacts,
  type PromotionRule,
} from "../lib/promotions/engine";
import { DEFAULT_BADGE, promotionInputSchema } from "../lib/promotions/schema";

function rule(overrides: Partial<PromotionRule>): PromotionRule {
  return {
    id: "r1", name: "Test", kind: "PRICE", priority: 0, discountType: "PERCENT", discountValue: 20,
    variantPrices: {}, volumeTiers: [], volumeScope: "LINE", loyaltyMinOrders: null, newWithinDays: null,
    stackWithVolume: false, allowDiscountCodes: true, scope: "ALL", productIds: [], categoryIds: [], excludedProductIds: [],
    startsAt: null, endsAt: null, weekdays: [], dailyStartMinute: null, dailyEndMinute: null, badge: DEFAULT_BADGE,
    ...overrides,
  };
}

const now = new Date("2026-10-07T10:00:00Z"); // Wednesday 12:00 in Amsterdam
const product = { productId: "p1", categoryIds: ["c1"] };
const variant = { variantId: "v1", regularCents: 999, saleCents: null };

function line(overrides: Partial<CartLineFacts> = {}): CartLineFacts {
  return { lineId: "l1", productId: "p1", categoryIds: ["c1"], variantId: "v1", regularCents: 1000, saleCents: null, quantity: 1, ...overrides };
}

test("Amsterdam clock follows summer and winter time", () => {
  assert.deepEqual(amsterdamClock(new Date("2026-10-07T10:00:00Z")), { isoWeekday: 3, minuteOfDay: 720 });
  assert.deepEqual(amsterdamClock(new Date("2026-12-06T23:30:00Z")), { isoWeekday: 1, minuteOfDay: 30 }, "Sunday 23:30 UTC is Monday 00:30 in winter");
});

test("schedules: dates, weekdays and a daily time window", () => {
  assert.equal(isPromotionLive(rule({ startsAt: new Date("2026-10-08T00:00:00Z") }), now), false);
  assert.equal(isPromotionLive(rule({ endsAt: now }), now), false, "the end moment is exclusive");
  assert.equal(isPromotionLive(rule({ weekdays: [6, 7] }), now), false, "weekend only");
  assert.equal(isPromotionLive(rule({ weekdays: [3] }), now), true);
  assert.equal(isPromotionLive(rule({ dailyStartMinute: 9 * 60, dailyEndMinute: 12 * 60 }), now), false, "12:00 is past a 09:00-12:00 window");
  assert.equal(isPromotionLive(rule({ dailyStartMinute: 9 * 60, dailyEndMinute: 17 * 60 }), now), true);
});

test("percentage, amount off and fixed price, rounded per unit and never below a cent", () => {
  assert.equal(bestPrice([rule({})], product, variant, now).unitCents, 799, "20% off 9.99 is 7.992 → 7.99");
  assert.equal(bestPrice([rule({ discountType: "AMOUNT_OFF", discountValue: 250 })], product, variant, now).unitCents, 749);
  assert.equal(bestPrice([rule({ discountType: "AMOUNT_OFF", discountValue: 5000 })], product, variant, now).unitCents, 1);
  assert.equal(bestPrice([rule({ discountType: "FIXED_PRICE", discountValue: 500, variantPrices: { v1: 450 } })], product, variant, now).unitCents, 450, "variant price wins over the general fixed price");
});

test("a promotion never raises the price and the lowest offer wins", () => {
  const sale = { ...variant, saleCents: 700 };
  const result = bestPrice([rule({ discountValue: 10 })], product, sale, now);
  assert.equal(result.unitCents, 700, "the existing sale price stays when the promotion is worse");
  assert.equal(result.rule, null);
  const two = bestPrice([rule({ id: "a", discountValue: 10 }), rule({ id: "b", discountValue: 30 })], product, variant, now);
  assert.equal(two.rule?.id, "b");
  assert.equal(two.unitCents, 699);
});

test("targeting: products, categories and exclusions", () => {
  assert.equal(bestPrice([rule({ scope: "PRODUCTS", productIds: ["p2"] })], product, variant, now).rule, null);
  assert.equal(bestPrice([rule({ scope: "CATEGORIES", categoryIds: ["c1"] })], product, variant, now).rule?.id, "r1");
  assert.equal(bestPrice([rule({ excludedProductIds: ["p1"] })], product, variant, now).rule, null);
});

test("loyalty discount applies only to known returning customers", () => {
  const loyalty = rule({ kind: "LOYALTY", discountType: null, discountValue: 5, loyaltyMinOrders: 3 });
  assert.equal(bestPrice([loyalty], product, variant, now).rule, null, "unknown customer");
  assert.equal(bestPrice([loyalty], product, variant, now, { paidOrders: 2 }).rule, null);
  assert.equal(bestPrice([loyalty], product, variant, now, { paidOrders: 3 }).unitCents, 949);
});

test("volume tiers per line, per product and across the promotion", () => {
  const tiers = [{ minQuantity: 3, percentOff: 10 }, { minQuantity: 6, percentOff: 15 }];
  assert.equal(tierFor(tiers, 2), null);
  assert.equal(tierFor(tiers, 7)?.percentOff, 15);
  const lines = [line({ lineId: "a", variantId: "v1", quantity: 2 }), line({ lineId: "b", variantId: "v2", quantity: 2 })];
  const perLine = priceCartWithPromotions(lines, [rule({ kind: "VOLUME", discountType: null, volumeTiers: tiers, volumeScope: "LINE" })], now);
  assert.deepEqual(perLine.map((l) => l.unitPriceCents), [1000, 1000]);
  const perProduct = priceCartWithPromotions(lines, [rule({ kind: "VOLUME", discountType: null, volumeTiers: tiers, volumeScope: "PRODUCT" })], now);
  assert.deepEqual(perProduct.map((l) => l.unitPriceCents), [900, 900], "2 + 2 of one product reach 3");
  assert.equal(perProduct[0].promotionLabel, "Stapelkorting 10%");
  const mixed = priceCartWithPromotions(
    [line({ lineId: "a", productId: "p1", quantity: 3 }), line({ lineId: "b", productId: "p2", quantity: 3 })],
    [rule({ kind: "VOLUME", discountType: null, volumeTiers: tiers, volumeScope: "PROMOTION" })],
    now,
  );
  assert.deepEqual(mixed.map((l) => l.unitPriceCents), [850, 850], "3 + 3 across products reach 6");
});

test("volume tiers stack on a price promotion only when allowed, otherwise the better one wins", () => {
  const tiers = [{ minQuantity: 2, percentOff: 10 }];
  const volume = rule({ id: "vol", kind: "VOLUME", discountType: null, volumeTiers: tiers });
  const noStack = priceCartWithPromotions([line({ quantity: 2 })], [rule({ id: "act", discountValue: 20 }), volume], now)[0];
  assert.equal(noStack.unitPriceCents, 800, "20% beats 10%, no stacking");
  assert.equal(noStack.promotionId, "act");
  const stacked = priceCartWithPromotions([line({ quantity: 2 })], [rule({ id: "act", discountValue: 20, stackWithVolume: true }), volume], now)[0];
  assert.equal(stacked.unitPriceCents, 720, "20% then 10%");
  assert.equal(stacked.promotionLabel, "Actie! + Stapelkorting 10%");
  const volumeWins = priceCartWithPromotions([line({ quantity: 2 })], [rule({ id: "act", discountValue: 5 }), volume], now)[0];
  assert.equal(volumeWins.unitPriceCents, 900);
  assert.equal(volumeWins.promotionId, "vol");
});

test("discount codes are blocked when an applied promotion says so", () => {
  const priced = priceCartWithPromotions([line()], [rule({ allowDiscountCodes: false })], now)[0];
  assert.equal(priced.allowsDiscountCodes, false);
  const notApplied = priceCartWithPromotions([line()], [rule({ allowDiscountCodes: false, scope: "PRODUCTS", productIds: ["other"] })], now)[0];
  assert.equal(notApplied.allowsDiscountCodes, true);
  assert.equal(notApplied.promotionLabel, null);
});

test("the storefront view shows at most two labels, the real percentage and a near countdown", () => {
  const view = productPromotionView(
    [
      rule({ id: "price", priority: 5, endsAt: new Date("2026-10-09T10:00:00Z"), badge: { ...DEFAULT_BADGE, showCountdown: true } }),
      rule({ id: "new", kind: "LABEL", discountType: null, priority: 9, newWithinDays: 30, badge: { ...DEFAULT_BADGE, text: { nl: "Nieuw", en: "New", fr: "" } } }),
      rule({ id: "guarantee", kind: "LABEL", discountType: null, priority: 1 }),
    ],
    { ...product, createdAt: new Date("2026-10-01T00:00:00Z") },
    [{ variantId: "v1", regularCents: 1000, saleCents: null }, { variantId: "v2", regularCents: 2000, saleCents: null }],
    now,
    "en",
  );
  assert.deepEqual(view.badges.map((b) => b.id), ["new", "price"]);
  assert.equal(view.badges[0].text, "New");
  assert.equal(view.badges[1].percentOff, 20);
  assert.equal(view.badges[1].countdownEndsAt, "2026-10-09T10:00:00.000Z");
  assert.equal(view.variantPrices.v2.unitCents, 1600);
});

test("a price label is hidden when it does not lower any price", () => {
  const view = productPromotionView([rule({ discountValue: 10 })], product, [{ variantId: "v1", regularCents: 1000, saleCents: 500 }], now, "nl");
  assert.equal(view.badges.length, 0);
});

test("countdown wording", () => {
  assert.equal(countdownText("2026-10-07T14:00:00Z", now, "nl"), "Nog 4 uur");
  assert.equal(countdownText("2026-10-08T05:00:00Z", now, "nl"), "Alleen vandaag");
  assert.equal(countdownText("2026-10-10T10:00:00Z", now, "nl"), "Nog 3 dagen");
  assert.equal(countdownText("2026-10-06T10:00:00Z", now, "nl"), null);
});

test("stored rows with broken JSON fall back to safe defaults", () => {
  const parsed = ruleFromRow({
    ...rule({}),
    status: "ACTIVE",
    kind: "VOLUME",
    variantPrices: "nonsense",
    volumeTiers: [{ minQuantity: 1, percentOff: 50 }],
    volumeScope: "WHATEVER",
    badge: { text: "x" },
  });
  assert.deepEqual(parsed.volumeTiers, [], "a tier from 1 piece is invalid");
  assert.deepEqual(parsed.variantPrices, {});
  assert.equal(parsed.volumeScope, "LINE");
  assert.deepEqual(parsed.badge, DEFAULT_BADGE);
});

test("admin input is checked per kind", () => {
  const base = {
    name: "Najaarsactie", kind: "PRICE", status: "ACTIVE", priority: 0, discountType: "PERCENT", discountValue: 20, variantPrices: null,
    volumeTiers: null, volumeScope: null, loyaltyMinOrders: null, newWithinDays: null, stackWithVolume: false, allowDiscountCodes: true,
    scope: "ALL", productIds: [], categoryIds: [], excludedProductIds: [], startsAt: null, endsAt: null, weekdays: [],
    dailyStartMinute: null, dailyEndMinute: null, badge: DEFAULT_BADGE,
  };
  assert.equal(promotionInputSchema.safeParse(base).success, true);
  assert.equal(promotionInputSchema.safeParse({ ...base, discountValue: 95 }).success, false);
  assert.equal(promotionInputSchema.safeParse({ ...base, scope: "PRODUCTS" }).success, false);
  assert.equal(promotionInputSchema.safeParse({ ...base, kind: "VOLUME", volumeTiers: null }).success, false);
  assert.equal(promotionInputSchema.safeParse({ ...base, startsAt: "2026-10-10T00:00:00+02:00", endsAt: "2026-10-09T00:00:00+02:00" }).success, false);
  assert.equal(promotionInputSchema.safeParse({ ...base, dailyStartMinute: 600, dailyEndMinute: null }).success, false);
});
