import assert from "node:assert/strict";
import test from "node:test";

import { clearExchangeRateCache, eurRateFor, parseEcbRates, toEuroCents } from "../lib/developer-portal/fx";

const xml = (days: Array<[string, string]>) => `<?xml version="1.0"?><gesmes:Envelope><Cube>${days.map(([date, rate]) => `<Cube time="${date}"><Cube currency="USD" rate="${rate}"/><Cube currency="JPY" rate="178.49"/></Cube>`).join("")}</Cube></gesmes:Envelope>`;

test("ECB rates are read per date for the requested currency", () => {
  const rates = parseEcbRates(xml([["2026-10-01", "1.1298"], ["2026-09-30", "1.1250"]]), "USD");
  assert.equal(rates.get("2026-10-01"), 1.1298);
  assert.equal(rates.get("2026-09-30"), 1.125);
});

test("the rate of the invoice date is used, or the last one before it", async () => {
  clearExchangeRateCache();
  const recent = xml([["2026-10-02", "1.1300"], ["2026-10-01", "1.1298"], ["2026-09-30", "1.1250"], ["2026-07-06", "1.0900"]]);
  const full = xml([["2025-01-03", "1.0300"], ["2025-01-02", "1.0350"]]);
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => { urls.push(url); return new Response(url.includes("90d") ? recent : full); }) as unknown as typeof fetch;

  assert.deepEqual(await eurRateFor("USD", "2026-10-01", fetchImpl), { currency: "USD", rate: 1.1298, rateDate: "2026-10-01" });
  // Saturday 3 October: the Friday rate applies.
  assert.deepEqual(await eurRateFor("USD", "2026-10-04", fetchImpl), { currency: "USD", rate: 1.13, rateDate: "2026-10-02" });
  assert.equal(urls.filter((url) => url.includes("90d")).length, 1, "rates are cached");
  // Older than the 90-day file: the full history is used.
  assert.deepEqual(await eurRateFor("USD", "2025-01-04", fetchImpl), { currency: "USD", rate: 1.03, rateDate: "2025-01-03" });
  await assert.rejects(eurRateFor("USD", "2024-12-01", fetchImpl), (error: Error & { code?: string }) => error.code === "NO_RATE");
});

test("dollar cents become euro cents at the rate (dollars per euro)", () => {
  assert.equal(toEuroCents(11_298, 1.1298), 10_000);
  assert.equal(toEuroCents(100, 1.1298), 89);
});
