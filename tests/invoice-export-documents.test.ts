import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

import { buildInvoicePdf, buildInvoiceXlsx, exportScopeLabel, invoiceExportTables, moneyTotals } from "../lib/invoice-export-documents";
import type { BusinessInvoiceRow, PrivateOrderRow } from "../lib/invoice-export";
import { safeSheetName } from "../lib/xlsx-writer";

const business: BusinessInvoiceRow[] = [
  { invoiceNumber: "NL-2026-0001", country: "NL", customerNumber: "ZK-00001", companyName: "Café & Co \"De Hoek\"", createdAt: new Date("2026-09-03T10:00:00Z"), subtotalCents: 10000, vatRatePercent: 9, vatAmountCents: 900, totalCents: 10900, vatRegime: "STANDARD", peppolStatus: "SENT" },
  { invoiceNumber: "BE-2026-0002", country: "BE", customerNumber: null, companyName: "Brasserie Ţest", createdAt: new Date("2026-09-04T10:00:00Z"), subtotalCents: 5000, vatRatePercent: 0, vatAmountCents: 0, totalCents: 5000, vatRegime: "REVERSE_CHARGE", peppolStatus: "NOT_SENT" },
];
const orders: PrivateOrderRow[] = [
  { orderNumber: "DN-2026-00010", country: "NL", contactName: "Fedor Jansen", contactEmail: "f@example.com", createdAt: new Date("2026-09-05T08:00:00Z"), paidAt: new Date("2026-09-05T08:01:00Z"), status: "PAID", subtotalCents: 2000, discountCents: 0, shippingCents: 495, totalCents: 2495, refundedCents: 0 },
  { orderNumber: "DN-2026-00011", country: "BE", contactName: "=SUM(A1)", contactEmail: "x@example.com", createdAt: new Date("2026-09-06T08:00:00Z"), paidAt: null, status: "FULFILLED", subtotalCents: 1000, discountCents: 100, shippingCents: 695, totalCents: 1595, refundedCents: 500 },
];

function hasOpenpyxl(): boolean {
  try {
    execFileSync("python3", ["-c", "import openpyxl"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("all categories give an overview plus one tab per category", () => {
  assert.deepEqual(invoiceExportTables("alle", business, orders).map((table) => table.name), ["Overzicht", "Zakelijk", "Particulier"]);
  assert.deepEqual(invoiceExportTables("zakelijk", business, orders).map((table) => table.name), ["Zakelijk"]);
  assert.deepEqual(invoiceExportTables("particulier", business, orders).map((table) => table.name), ["Particulier"]);
});

test("totals add up the money columns in euros", () => {
  const [zakelijk] = invoiceExportTables("zakelijk", business, orders);
  const totals = moneyTotals(zakelijk);
  assert.equal(totals[5], 150, "subtotal excl. VAT");
  assert.equal(totals[7], 9, "VAT");
  assert.equal(totals[8], 159, "total incl. VAT");
  assert.equal(totals[0], null);
});

test("the workbook opens in openpyxl with tabs, numbers, a frozen header and SUM totals", { skip: !hasOpenpyxl() && "openpyxl not installed" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "xlsx-"));
  const file = join(dir, "facturen.xlsx");
  writeFileSync(file, buildInvoiceXlsx(invoiceExportTables("alle", business, orders)));
  const script = `
import json, openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1])
out = {}
for ws in wb.worksheets:
    last = ws.max_row
    out[ws.title] = {
        "header": [c.value for c in ws[1]],
        "rows": ws.max_row,
        "freeze": ws.freeze_panes,
        "total_label": ws.cell(row=last, column=1).value,
        "totals": [c.value for c in ws[last]],
        "second": [c.value for c in ws[2]],
        "money_format": ws.cell(row=2, column=6).number_format,
    }
print(json.dumps(out, default=str))
`;
  const result = JSON.parse(execFileSync("python3", ["-c", script, file], { encoding: "utf8" }));
  assert.deepEqual(Object.keys(result), ["Overzicht", "Zakelijk", "Particulier"]);
  assert.equal(result.Zakelijk.header[0], "Factuurnummer");
  assert.equal(result.Zakelijk.freeze, "A2");
  assert.equal(result.Zakelijk.rows, 4, "header + 2 invoices + totals");
  assert.equal(result.Zakelijk.total_label, "Totaal");
  assert.equal(result.Zakelijk.totals[8], "=SUM(I2:I3)");
  assert.equal(result.Zakelijk.second[3], "Café & Co \"De Hoek\"", "special characters survive");
  assert.equal(result.Zakelijk.second[5], 100, "amounts are numbers, not text");
  assert.match(result.Zakelijk.money_format, /€/u);
  assert.equal(result.Particulier.second[2], "Fedor Jansen");
  assert.equal(result.Overzicht.rows, 6);
});

test("a formula-looking customer name stays text in Excel", { skip: !hasOpenpyxl() && "openpyxl not installed" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "xlsx-"));
  const file = join(dir, "p.xlsx");
  writeFileSync(file, buildInvoiceXlsx(invoiceExportTables("particulier", business, orders)));
  const value = execFileSync("python3", ["-c", "import openpyxl,sys; ws=openpyxl.load_workbook(sys.argv[1]).active; print(ws.cell(row=3,column=3).data_type, ws.cell(row=3,column=3).value)", file], { encoding: "utf8" }).trim();
  assert.equal(value, "s =SUM(A1)", "inline string, not a formula");
});

test("sheet names follow Excel's rules", () => {
  const taken = new Set<string>();
  assert.equal(safeSheetName("Zakelijk", taken), "Zakelijk");
  assert.equal(safeSheetName("zakelijk", taken), "zakelijk 2");
  assert.equal(safeSheetName("a/b:c*d?[e]", taken), "a b c d  e");
  assert.equal(safeSheetName("x".repeat(40), taken).length, 31);
});

test("the PDF has a page per category and handles characters outside the standard font", async () => {
  const pdf = await buildInvoicePdf(invoiceExportTables("alle", business, orders), { title: "Facturen", scope: exportScopeLabel("alle", null, null), generatedAt: new Date("2026-10-07T10:00:00Z") });
  const parsed = await PDFDocument.load(pdf);
  assert.equal(parsed.getPageCount(), 3);
  assert.equal(parsed.getTitle(), "Facturen");
});

test("long exports continue on new pages", async () => {
  const many = Array.from({ length: 120 }, (_, index) => ({ ...orders[0], orderNumber: `DN-${index}` }));
  const pdf = await buildInvoicePdf(invoiceExportTables("particulier", [], many), { title: "Facturen", scope: "test", generatedAt: new Date() });
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 3);
});
