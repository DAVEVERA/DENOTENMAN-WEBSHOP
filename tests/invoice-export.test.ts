import assert from "node:assert/strict";
import test from "node:test";

import { amsterdamMidnight, buildInvoiceCsv, csvCell, exportFilename, parseExportPeriod, privateOrderVat, recentPeriods } from "../lib/invoice-export";

test("periods start and end at midnight Dutch time, across summer and winter time", () => {
  const september = parseExportPeriod("2026-09")!;
  assert.equal(september.from.toISOString(), "2026-08-31T22:00:00.000Z", "summer time: UTC+2");
  assert.equal(september.to.toISOString(), "2026-09-30T22:00:00.000Z");
  const q4 = parseExportPeriod("2026-Q4")!;
  assert.equal(q4.from.toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(q4.to.toISOString(), "2026-12-31T23:00:00.000Z", "winter time: UTC+1");
  assert.equal(parseExportPeriod("2026-H1")!.to.toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(parseExportPeriod("2026")!.from.toISOString(), "2025-12-31T23:00:00.000Z");
  assert.equal(amsterdamMidnight(2026, 2, 29).toISOString(), "2026-03-28T23:00:00.000Z", "the day of the switch to summer time");
});

test("only well-formed periods are accepted", () => {
  for (const bad of ["2026-13", "2026-Q5", "2026-H3", "26", "2026-9", "2026-09; drop"]) assert.equal(parseExportPeriod(bad), null, bad);
  assert.equal(parseExportPeriod("2026-Q3")!.label, "Q3 2026");
  assert.equal(parseExportPeriod("2026-09")!.label, "september 2026");
  assert.equal(parseExportPeriod("2026-H2")!.label, "2e halfjaar 2026");
});

test("recent periods start with the current one and step back across years", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  assert.deepEqual(recentPeriods("maand", now, 3).map((period) => period.value), ["2026-01", "2025-12", "2025-11"]);
  assert.deepEqual(recentPeriods("kwartaal", now, 3).map((period) => period.value), ["2026-Q1", "2025-Q4", "2025-Q3"]);
  assert.deepEqual(recentPeriods("halfjaar", now, 3).map((period) => period.value), ["2026-H1", "2025-H2", "2025-H1"]);
  assert.deepEqual(recentPeriods("jaar", now, 2).map((period) => period.value), ["2026", "2025"]);
  // 31 December 23:30 in Amsterdam is already the new year.
  assert.equal(recentPeriods("maand", new Date("2026-12-31T23:30:00Z"), 1)[0].value, "2027-01");
});

const business = [{ invoiceNumber: "NL-2026-001", country: "NL", customerNumber: "Z-1", companyName: "Bakkerij, De Korst", createdAt: new Date("2026-09-30T21:30:00Z"), subtotalCents: 10_000, vatRatePercent: 9, vatAmountCents: 900, totalCents: 10_900, vatRegime: "STANDARD", peppolStatus: "SENT" }];
const orders = [{ orderNumber: "DN-2026-00042", country: "BE", contactName: "=HYPERLINK(\"evil\")", contactEmail: "klant@example.com", createdAt: new Date("2026-09-12T10:00:00Z"), paidAt: new Date("2026-09-12T10:01:00Z"), status: "FULFILLED", subtotalCents: 2_495, discountCents: 250, shippingCents: 695, totalCents: 2_940, refundedCents: 500 }];

test("each export type has its own columns", () => {
  const zakelijk = buildInvoiceCsv("zakelijk", business, []).split("\n");
  assert.match(zakelijk[0], /^﻿Factuurnummer,Land,Klantnummer,Bedrijf/u);
  assert.equal(zakelijk[1], 'NL-2026-001,NL,Z-1,"Bakkerij, De Korst",2026-09-30,100.00,9,9.00,109.00,Standaard,SENT', "dates are Dutch dates");

  const particulier = buildInvoiceCsv("particulier", [], orders).split("\n");
  assert.match(particulier[0], /Bestelnummer,Land,Klant,E-mail,Besteldatum,Betaaldatum,Status/u);
  assert.match(particulier[1], /^DN-2026-00042,BE,/u);
  // BE private: 29.40 incl. 6% VAT = 27.74 + 1.66.
  assert.match(particulier[1], /,Verzonden,2\.50,6\.95,27\.74,6,1\.66,29\.40,5\.00,24\.40$/u);

  const alle = buildInvoiceCsv("alle", business, orders).split("\n");
  assert.equal(alle.length, 3);
  assert.match(alle[0], /Subtotaal excl\. BTW,BTW-percentage,BTW-bedrag,Totaal incl\. BTW/u);
  assert.match(alle[1], /^Particulier,DN-2026-00042,BE,.*,27\.74,6,1\.66,29\.40,5\.00$/u, "rows are in date order");
  assert.match(alle[2], /^Zakelijk,NL-2026-001,NL,.*,100\.00,9,9\.00,109\.00,0\.00$/u);
});

test("cells that a spreadsheet would run as a formula are defused", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell("-5.00"), "-5.00", "negative amounts stay numbers");
  assert.match(buildInvoiceCsv("particulier", [], orders), /"'=HYPERLINK\(""evil""\)"/u);
});

test("file names say what is in the export", () => {
  assert.equal(exportFilename("particulier", "BE", parseExportPeriod("2026-Q3")), "facturen-particulier-be-2026-q3.csv");
  assert.equal(exportFilename("alle", null, null), "facturen-alle-alle-landen-alles.csv");
});

test("private orders split the paid total into amount excluding VAT and VAT: 9% NL, 6% BE", () => {
  assert.deepEqual(privateOrderVat("NL", 10_900), { ratePercent: 9, subtotalCents: 10_000, vatCents: 900, totalCents: 10_900 });
  assert.deepEqual(privateOrderVat("BE", 10_600), { ratePercent: 6, subtotalCents: 10_000, vatCents: 600, totalCents: 10_600 });
  // Rounding never loses a cent: subtotal + VAT is always the paid total.
  for (const total of [1, 99, 2_940, 3_795, 12_345]) {
    for (const country of ["NL", "BE"]) {
      const vat = privateOrderVat(country, total);
      assert.equal(vat.subtotalCents + vat.vatCents, total, `${country} ${total}`);
    }
  }
});
