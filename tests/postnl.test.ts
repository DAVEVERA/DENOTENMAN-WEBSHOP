import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateShipmentWeightGrams,
  determineLabelAction,
  POSTNL_REQUEST_TIMEOUTS,
  resolvePostnlProductCode,
  splitPostnlHouseNumber,
} from "../lib/postnl";
import { parseAmsterdamCalendarDay } from "../lib/amsterdam-calendar";

assert.equal(
  calculateShipmentWeightGrams([
    { quantity: 2, variant: { weightGrams: 500 } },
    { quantity: 4, variant: { weightGrams: 250 } },
    { quantity: 1, variant: { weightGrams: 1_000 } },
  ]),
  3_000
);

assert.throws(
  () => calculateShipmentWeightGrams([]),
  /Geen geldig verzendgewicht/
);

assert.equal(determineLabelAction("PAID", false), "create");
assert.equal(determineLabelAction("FULFILLED", false), "create");
assert.equal(determineLabelAction("PAID", true), "reuse");
assert.equal(determineLabelAction("FULFILLED", true), "reuse");
assert.equal(determineLabelAction("PENDING", false), "reject");
assert.equal(determineLabelAction("CANCELLED", false), "reject");
assert.equal(determineLabelAction("CANCELLED", true), "reject");
assert.equal(determineLabelAction("REFUNDED", false), "reject");
assert.equal(determineLabelAction("PAID", false, true), "reject");
assert.equal(determineLabelAction("FULFILLED", true, true), "reject");
assert.ok(POSTNL_REQUEST_TIMEOUTS.barcodeMs > 0);
assert.ok(POSTNL_REQUEST_TIMEOUTS.barcodeMs <= 15_000);
assert.ok(POSTNL_REQUEST_TIMEOUTS.labelMs > 0);
assert.ok(POSTNL_REQUEST_TIMEOUTS.labelMs <= 30_000);
assert.deepEqual(splitPostnlHouseNumber("7a"), { houseNumber: "7", extension: "a" });
assert.deepEqual(splitPostnlHouseNumber("12-2"), { houseNumber: "12", extension: "-2" });
assert.deepEqual(splitPostnlHouseNumber("123 bis"), { houseNumber: "123", extension: "bis" });
assert.deepEqual(splitPostnlHouseNumber("42"), { houseNumber: "42", extension: undefined });
assert.throws(() => splitPostnlHouseNumber("bis"), /Ongeldig huisnummer/);
assert.equal(parseAmsterdamCalendarDay("2026-08-24", false)?.toISOString(), "2026-08-23T22:00:00.000Z");
assert.equal(parseAmsterdamCalendarDay("2026-08-24", true)?.toISOString(), "2026-08-24T21:59:59.999Z");
assert.equal(parseAmsterdamCalendarDay("2026-01-24", false)?.toISOString(), "2026-01-23T23:00:00.000Z");
assert.equal(parseAmsterdamCalendarDay("2026-01-24", true)?.toISOString(), "2026-01-24T22:59:59.999Z");
assert.equal(parseAmsterdamCalendarDay("2026-02-30", false), null);

const originalProductCodes = {
  generic: process.env.POSTNL_PRODUCT_CODE,
  nl: process.env.POSTNL_PRODUCT_CODE_NL,
  be: process.env.POSTNL_PRODUCT_CODE_BE,
};
delete process.env.POSTNL_PRODUCT_CODE;
delete process.env.POSTNL_PRODUCT_CODE_NL;
delete process.env.POSTNL_PRODUCT_CODE_BE;
try {
  assert.equal(resolvePostnlProductCode("NL"), "3085");
  assert.equal(resolvePostnlProductCode("BE"), "4946");
} finally {
  for (const [key, value] of Object.entries({
    POSTNL_PRODUCT_CODE: originalProductCodes.generic,
    POSTNL_PRODUCT_CODE_NL: originalProductCodes.nl,
    POSTNL_PRODUCT_CODE_BE: originalProductCodes.be,
  })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

const labelRuntimeSource = readFileSync(
  new URL("../lib/postnl-labels.ts", import.meta.url),
  "utf8"
);
assert.doesNotMatch(labelRuntimeSource, /\$transaction/);
assert.match(labelRuntimeSource, /postnlLabelClaimToken/);
assert.match(labelRuntimeSource, /createShipmentBarcode/);

for (const route of [
  "../app/api/admin/orders/[id]/postnl-label/route.ts",
  "../app/api/admin/orders/postnl-labels/route.ts",
]) {
  assert.match(
    readFileSync(new URL(route, import.meta.url), "utf8"),
    /isSameOriginMutation\(request\)/
  );
}

const bulkRouteSource = readFileSync(new URL("../app/api/admin/orders/postnl-labels/route.ts", import.meta.url), "utf8");
assert.match(bulkRouteSource, /MAX_LABELS_PER_BATCH = 20/);
assert.match(bulkRouteSource, /LABEL_CONCURRENCY = 4/);
assert.match(bulkRouteSource, /BATCH_TOO_LARGE/);
assert.match(bulkRouteSource, /parseAmsterdamCalendarDay\(fromRaw, false\)/);
assert.match(bulkRouteSource, /parseAmsterdamCalendarDay\(toRaw, true\)/);
assert.match(bulkRouteSource, /from\.getTime\(\) > to\.getTime\(\)/);

console.log("postnl tests passed");
