import assert from "node:assert/strict";
import test from "node:test";

import { extractInvoiceFromFile, interpretExtraction, InvoiceExtractionError } from "../lib/developer-portal/extract";

const reading = (overrides: Record<string, unknown> = {}) => ({
  isInvoice: true,
  invoiceNumber: "2026-041",
  issueDate: "2026-09-30",
  dueDate: "2026-10-14",
  description: "Onderhoud webshop september",
  currency: "EUR",
  lines: [
    { description: "Ontwikkeling", amountExclVat: 850, vatRatePercent: 21 },
    { description: "Hosting", amountExclVat: 25, vatRatePercent: 21 },
  ],
  subtotalExclVat: 875,
  vatAmount: 183.75,
  totalInclVat: 1058.75,
  ...overrides,
});

test("a readable invoice becomes lines in cents with the printed totals", () => {
  const result = interpretExtraction(reading());
  assert.equal(result.invoiceNumber, "2026-041");
  assert.deepEqual(result.lines, [
    { description: "Ontwikkeling", quantity: 1, unitPriceCents: 85_000, vatRate: 21 },
    { description: "Hosting", quantity: 1, unitPriceCents: 2_500, vatRate: 21 },
  ]);
  assert.deepEqual(result.printed, { subtotalCents: 87_500, vatCents: 18_375, totalCents: 105_875 });
  assert.deepEqual(result.warnings, []);
});

test("an invoice without readable lines becomes one line at the rate that explains its VAT", () => {
  const result = interpretExtraction(reading({ lines: [], subtotalExclVat: 100, vatAmount: 9, totalInclVat: 109 }));
  assert.deepEqual(result.lines, [{ description: "Onderhoud webshop september", quantity: 1, unitPriceCents: 10_000, vatRate: 9 }]);
});

test("disagreements between the lines and the printed total are flagged, not hidden", () => {
  const result = interpretExtraction(reading({ totalInclVat: 1100 }));
  assert.ok(result.warnings.some((warning) => /tellen subtotaal en btw niet op/u.test(warning)));
  assert.ok(result.warnings.some((warning) => /Controleer de regels/u.test(warning)));
  assert.ok(interpretExtraction(reading({ issueDate: null })).warnings.some((warning) => /Geen factuurdatum/u.test(warning)));
});

test("unsupported invoices are refused with a clear reason", () => {
  const code = (raw: unknown) => { try { interpretExtraction(raw); return "OK"; } catch (error) { return (error as InvoiceExtractionError).code; } };
  assert.equal(code(reading({ lines: [{ description: "Iets", amountExclVat: 100, vatRatePercent: 6 }] })), "VAT_RATE");
  assert.equal(code(reading({ isInvoice: false })), "NOT_AN_INVOICE");
  assert.equal(code(reading({ currency: "GBP" })), "CURRENCY");
  assert.equal(code(reading({ lines: [{ description: "Credit", amountExclVat: -50, vatRatePercent: 21 }] })), "NEGATIVE");
  assert.equal(code({ nonsense: true }), "EXTRACTION_INVALID");
});

test("files are checked before anything is sent to the AI", async () => {
  let called = false;
  const generate = async () => { called = true; return { text: JSON.stringify(reading()) }; };
  await assert.rejects(extractInvoiceFromFile({ bytes: Buffer.from("not a pdf"), contentType: "application/pdf" }, generate), (error: InvoiceExtractionError) => error.code === "FILE_TYPE");
  await assert.rejects(extractInvoiceFromFile({ bytes: Buffer.from("x"), contentType: "text/html" }, generate), (error: InvoiceExtractionError) => error.code === "FILE_TYPE");
  assert.equal(called, false);
  const result = await extractInvoiceFromFile({ bytes: Buffer.from("%PDF-1.7 test"), contentType: "application/pdf" }, generate);
  assert.equal(called, true);
  assert.equal(result.printed.totalCents, 105_875);
});

test("dollar invoices are read in dollars, to be converted to euros afterwards", () => {
  const result = interpretExtraction(reading({ currency: "USD", lines: [{ description: "Server", amountExclVat: 100, vatRatePercent: 0 }], subtotalExclVat: 100, vatAmount: 0, totalInclVat: 100 }));
  assert.equal(result.currency, "USD");
  assert.equal(result.lines[0].unitPriceCents, 10_000);
  assert.equal(interpretExtraction(reading({ currency: "$" })).currency, "USD");
  assert.equal(interpretExtraction(reading()).currency, "EUR");
});

test("a busy AI model hands the invoice to the next model", async () => {
  const models: string[] = [];
  const generate = async (request: { model: string }) => {
    models.push(request.model);
    if (models.length === 1) throw Object.assign(new Error("high demand"), { status: 503 });
    return { text: JSON.stringify(reading()) };
  };
  const result = await extractInvoiceFromFile({ bytes: Buffer.from("%PDF-1.7 test"), contentType: "application/pdf" }, generate);
  assert.equal(result.printed.totalCents, 105_875);
  assert.equal(models.length, 2);
  assert.notEqual(models[0], models[1]);
});
