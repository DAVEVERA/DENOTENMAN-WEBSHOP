import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_STOPS, MARKET_STOP_COLORS, getMarketStopForWeekday } from "../lib/market-schedule";

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
