import assert from "node:assert/strict";
import test from "node:test";

import { coerceExtraction, extractInvoiceFromFile, interpretExtraction, InvoiceExtractionError, normalizeInvoiceDate, normalizeInvoiceFile, parseAmount } from "../lib/developer-portal/extract";

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
  assert.equal(code(reading({ isInvoice: false })), "NOT_AN_INVOICE");
  assert.equal(code(reading({ currency: "GBP" })), "CURRENCY");
  assert.equal(code(reading({ lines: [{ description: "Credit", amountExclVat: -50, vatRatePercent: 21 }], subtotalExclVat: -50, vatAmount: -10.5, totalInclVat: -60.5 })), "NEGATIVE");
  assert.equal(code({ nonsense: true }), "EXTRACTION_INVALID");
  assert.equal(code("not an object"), "EXTRACTION_INVALID");
});

test("a VAT rate this system does not know becomes a separate VAT line, so the total still matches", () => {
  const result = interpretExtraction(reading({ lines: [{ description: "Entwicklung", amountExclVat: 950, vatRatePercent: 19 }], subtotalExclVat: 950, vatAmount: 180.5, totalInclVat: 1130.5 }));
  assert.deepEqual(result.lines.map((line) => [line.unitPriceCents, line.vatRate]), [[95_000, 0], [18_050, 0]]);
  assert.match(result.lines[1].description, /Btw 19%/u);
  assert.ok(result.warnings.some((warning) => /19% btw/u.test(warning)));
  assert.ok(!result.warnings.some((warning) => /Controleer de regels/u.test(warning)), "the lines add up to the printed total");
});

test("a discount line is folded into a line at the same rate instead of refusing the invoice", () => {
  const result = interpretExtraction(reading({
    lines: [{ description: "Werk", amountExclVat: 1000, vatRatePercent: 21 }, { description: "Korting", amountExclVat: -100, vatRatePercent: 21 }],
    subtotalExclVat: 900, vatAmount: 189, totalInclVat: 1089,
  }));
  assert.deepEqual(result.lines, [{ description: "Werk", quantity: 1, unitPriceCents: 90_000, vatRate: 21 }]);
  assert.ok(result.warnings.some((warning) => /kortingsregel/u.test(warning)));
});

test("harmless deviations in the model's answer are cleaned up instead of failing the reading", () => {
  const long = "x".repeat(400);
  const result = interpretExtraction(reading({
    invoiceNumber: "N".repeat(90),
    description: long,
    issueDate: "07-10-2026",
    dueDate: "2026-10-21T00:00:00Z",
    lines: [{ description: long, amountExclVat: "1.234,56", vatRatePercent: 0.21 }],
    subtotalExclVat: "€ 1.234,56",
    vatAmount: "259,26",
    totalInclVat: "1.493,82",
  }));
  assert.equal(result.invoiceNumber?.length, 60);
  assert.equal(result.title.length, 160);
  assert.equal(result.issueDate, "2026-10-07");
  assert.equal(result.dueDate, "2026-10-21");
  assert.deepEqual(result.lines.map((line) => [line.unitPriceCents, line.vatRate, line.description.length]), [[123_456, 21, 300]]);
  assert.deepEqual(result.printed, { subtotalCents: 123_456, vatCents: 25_926, totalCents: 149_382 });
  assert.deepEqual(result.warnings, []);
});

test("missing totals are rebuilt and impossible dates are dropped", () => {
  const rebuilt = interpretExtraction({ isInvoice: true, invoiceNumber: null, issueDate: "2026-02-30", dueDate: "zondag", description: "Werk", currency: "EUR", lines: [{ description: "Werk", amountExclVat: 100, vatRatePercent: 21 }] });
  assert.equal(rebuilt.issueDate, null);
  assert.equal(rebuilt.dueDate, null);
  assert.deepEqual(rebuilt.printed, { subtotalCents: 10_000, vatCents: 2_100, totalCents: 12_100 });
});

test("amounts and dates are read in the usual notations", () => {
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("$ 1,234.56"), 1234.56);
  assert.equal(parseAmount("12,5"), 12.5);
  assert.equal(parseAmount("-50"), -50);
  assert.equal(parseAmount("n.v.t."), null);
  assert.equal(normalizeInvoiceDate("7 oktober 2026"), "2026-10-07");
  assert.equal(normalizeInvoiceDate("October 7, 2026"), "2026-10-07");
  assert.equal(normalizeInvoiceDate("2026-10-7"), "2026-10-07");
  assert.equal(normalizeInvoiceDate("31/04/2026"), null);
  assert.equal(coerceExtraction(null), null);
});

test("the file type comes from the bytes, not from what the browser claims", async () => {
  const pdf = Buffer.from("%PDF-1.7 test");
  assert.equal((await normalizeInvoiceFile({ bytes: pdf, contentType: "" })).contentType, "application/pdf");
  assert.equal((await normalizeInvoiceFile({ bytes: pdf, contentType: "application/octet-stream", filename: "factuur.pdf" })).contentType, "application/pdf");
  assert.equal((await normalizeInvoiceFile({ bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf, 0x0a]), pdf]), contentType: "" })).contentType, "application/pdf", "a PDF with leading bytes is still a PDF");
  assert.equal((await normalizeInvoiceFile({ bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), contentType: "image/jpg" })).contentType, "image/jpeg");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  assert.equal((await normalizeInvoiceFile({ bytes: png, contentType: "" })).contentType, "image/png");
  await assert.rejects(normalizeInvoiceFile({ bytes: Buffer.from("<html>"), contentType: "text/html", filename: "x.html" }), (error: InvoiceExtractionError) => error.code === "FILE_TYPE");
  await assert.rejects(normalizeInvoiceFile({ bytes: Buffer.alloc(0), contentType: "application/pdf" }), (error: InvoiceExtractionError) => error.code === "FILE_SIZE");
});

test("an unusable answer is asked for again before giving up", async () => {
  let calls = 0;
  const generate = async () => { calls += 1; return { text: calls === 1 ? "```json\nnot json\n```" : calls === 2 ? "{\"nonsense\":true}" : JSON.stringify(reading()) }; };
  const result = await extractInvoiceFromFile({ bytes: Buffer.from("%PDF-1.7 test"), contentType: "application/pdf" }, generate);
  assert.equal(calls, 3);
  assert.equal(result.printed.totalCents, 105_875);
  let alwaysBad = 0;
  await assert.rejects(extractInvoiceFromFile({ bytes: Buffer.from("%PDF-1.7 test"), contentType: "application/pdf" }, async () => { alwaysBad += 1; return { text: "nope" }; }), (error: InvoiceExtractionError) => error.code === "EXTRACTION_INVALID");
  assert.equal(alwaysBad, 3);
  let notAnInvoice = 0;
  await assert.rejects(extractInvoiceFromFile({ bytes: Buffer.from("%PDF-1.7 test"), contentType: "application/pdf" }, async () => { notAnInvoice += 1; return { text: JSON.stringify(reading({ isInvoice: false })) }; }), (error: InvoiceExtractionError) => error.code === "NOT_AN_INVOICE");
  assert.equal(notAnInvoice, 1, "a clear 'not an invoice' is not asked again");
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
