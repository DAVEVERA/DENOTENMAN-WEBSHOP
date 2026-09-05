import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKET_STOPS,
  MARKET_STOP_COLORS,
  getMarketStopForWeekday,
  isPickupDayAllowedForLocation,
} from "../lib/market-schedule";

test("every market stop has a color mapping", () => {
  for (const id of Object.keys(MARKET_STOPS) as (keyof typeof MARKET_STOPS)[]) {
    assert.ok(MARKET_STOP_COLORS[id], `missing color mapping for ${id}`);
  }
});

test("pickup day maps to the expected weekday per location", () => {
  assert.equal(getMarketStopForWeekday(4).id, "hilvarenbeek");
  assert.equal(getMarketStopForWeekday(5).id, "uden");
  assert.equal(getMarketStopForWeekday(6).id, "antwerpen");
});

test("a fixed pickup location only permits dates for that location", () => {
  const thursday = new Date("2026-09-10T12:00:00+02:00");
  const friday = new Date("2026-09-11T12:00:00+02:00");

  assert.equal(isPickupDayAllowedForLocation(thursday, null), true);
  assert.equal(isPickupDayAllowedForLocation(thursday, "hilvarenbeek"), true);
  assert.equal(isPickupDayAllowedForLocation(thursday, "uden"), false);
  assert.equal(isPickupDayAllowedForLocation(friday, "uden"), true);
  assert.equal(isPickupDayAllowedForLocation(friday, "unknown"), false);
});
