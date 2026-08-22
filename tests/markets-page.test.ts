import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  MARKET_ROUTE_GROUPS,
  MARKET_STOPS,
  getMarketStopForDate,
  getMarketStopForWeekday,
} from "../lib/market-schedule";
import { pagePath } from "../lib/pages";

test("the fixed weekly route assigns every day to the requested destination", () => {
  const expected = [
    "haaren",
    "haaren",
    "haaren",
    "haaren",
    "hilvarenbeek",
    "uden",
    "antwerpen",
  ];

  assert.deepEqual(
    expected.map((_, weekdayIndex) => getMarketStopForWeekday(weekdayIndex).id),
    expected,
  );
  assert.equal(MARKET_ROUTE_GROUPS.flatMap((route) => route.weekdays).length, 7);
});

test("the current destination follows the Europe Amsterdam calendar day", () => {
  assert.equal(
    getMarketStopForDate(new Date("2026-08-19T22:30:00.000Z")).id,
    "hilvarenbeek",
  );
  assert.equal(
    getMarketStopForDate(new Date("2026-08-22T12:00:00.000Z")).id,
    "antwerpen",
  );
});

test("all marker coordinates stay inside the supplied map", () => {
  for (const stop of Object.values(MARKET_STOPS)) {
    assert.ok(stop.x > 0 && stop.x < 100, `${stop.name} has an invalid x coordinate`);
    assert.ok(stop.y > 0 && stop.y < 100, `${stop.name} has an invalid y coordinate`);
  }
});

test("the existing localized header destination renders the custom map page", async () => {
  const [pageSource, componentSource, mapFile] = await Promise.all([
    readFile("app/[locale]/pages/[slug]/page.tsx", "utf8"),
    readFile("app/[locale]/pages/[slug]/_components/MarketRouteMap.tsx", "utf8"),
    stat("public/pages/waar-is-de-notenman-kaart.png"),
  ]);

  assert.equal(pagePath("markets", "nl"), "/nl/paginas/markten");
  assert.equal(pagePath("markets", "en"), "/en/pages/markets");
  assert.equal(pagePath("markets", "fr"), "/fr/pages/marches");
  assert.match(pageSource, /key === "markets"/);
  assert.match(pageSource, /<MarketRouteMap copy=\{marketRouteCopy\[locale\]\}/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /tabIndex=\{0\}/);
  assert.match(componentSource, /onLoad=\{centerActiveStop\}/);
  assert.ok(mapFile.size > 0);
});
