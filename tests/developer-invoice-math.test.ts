import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDeveloperInvoiceTotals,
  developerInvoiceInputSchema,
  dueDateFor,
  dueReminder,
  formatDeveloperInvoiceNumber,
  invoiceDateFromInput,
} from "../lib/developer-portal/invoice-math";
import { buildDeveloperInvoiceNotice } from "../lib/developer-portal/notifications";

const day = 24 * 60 * 60 * 1000;

test("VAT is calculated per rate over the summed lines", () => {
  const totals = computeDeveloperInvoiceTotals([
    { description: "Ontwikkeling", quantity: 10.5, unitPriceCents: 7_500, vatRate: 21 },
    { description: "Hosting", quantity: 1, unitPriceCents: 1_999, vatRate: 21 },
    { description: "Advies zonder btw", quantity: 2, unitPriceCents: 5_000, vatRate: 0 },
  ]);
  assert.equal(totals.subtotalCents, 78_750 + 1_999 + 10_000);
  assert.deepEqual(totals.vatByRate, [
    { rate: 0, baseCents: 10_000, vatCents: 0 },
    { rate: 21, baseCents: 80_749, vatCents: 16_957 },
  ]);
  assert.equal(totals.totalCents, 90_749 + 16_957);
});

test("invoice input rejects empty lines, bad quantities and unknown VAT rates", () => {
  const base = { title: "Onderhoud", issueDate: "2026-09-30", paymentTermDays: 14, notes: null };
  assert.equal(developerInvoiceInputSchema.safeParse({ ...base, lines: [] }).success, false);
  assert.equal(developerInvoiceInputSchema.safeParse({ ...base, lines: [{ description: "Uren", quantity: 1.555, unitPriceCents: 100, vatRate: 21 }] }).success, false);
  assert.equal(developerInvoiceInputSchema.safeParse({ ...base, lines: [{ description: "Uren", quantity: 1, unitPriceCents: 100, vatRate: 19 }] }).success, false);
  assert.equal(developerInvoiceInputSchema.safeParse({ ...base, lines: [{ description: "Uren", quantity: 1.5, unitPriceCents: 100, vatRate: 9 }] }).success, true);
});

test("dates and numbers are stable", () => {
  const issue = invoiceDateFromInput("2026-09-30");
  assert.equal(issue.toISOString(), "2026-09-30T12:00:00.000Z");
  assert.equal(dueDateFor(issue, 14).toISOString(), "2026-10-14T12:00:00.000Z");
  assert.equal(formatDeveloperInvoiceNumber(2026, 7), "MNRV-2026-007");
});

test("the first reminder follows 7 days after sending, the second 14 days after that", () => {
  const sentAt = new Date("2026-09-01T09:00:00.000Z");
  const open = { status: "SENT", sentAt, firstReminderAt: null, secondReminderAt: null };
  assert.equal(dueReminder(open, new Date(sentAt.getTime() + 6 * day)), null);
  assert.equal(dueReminder(open, new Date(sentAt.getTime() + 7 * day)), "FIRST");

  const firstReminderAt = new Date(sentAt.getTime() + 7 * day);
  const reminded = { ...open, firstReminderAt };
  assert.equal(dueReminder(reminded, new Date(firstReminderAt.getTime() + 13 * day)), null);
  assert.equal(dueReminder(reminded, new Date(firstReminderAt.getTime() + 14 * day)), "SECOND");
  assert.equal(dueReminder({ ...reminded, secondReminderAt: new Date() }, new Date(firstReminderAt.getTime() + 90 * day)), null, "no third reminder");
  assert.equal(dueReminder({ ...open, status: "PAID" }, new Date(sentAt.getTime() + 30 * day)), null, "paid invoices get no reminders");
  assert.equal(dueReminder({ ...open, status: "DRAFT", sentAt: null }, new Date()), null);
});

test("notices name the invoice, the amount and every payment option, and escape user text", () => {
  const notice = buildDeveloperInvoiceNotice({
    kind: "FIRST_REMINDER",
    invoices: [{ number: "MNRV-2026-001", title: "Onderhoud <script>", subtotalCents: 10_000, vatCents: 2_100, totalCents: 12_100, issueDate: new Date("2026-09-01T12:00:00Z"), dueDate: new Date("2026-09-15T12:00:00Z") }],
    developerName: "MNRV",
    invoiceUrl: "https://denotenman.com/admin/ontwikkelaarsfacturen/abc",
    payment: { stripe: true, bankTransfer: { iban: "NL00BANK0123456789", accountHolder: "MNRV" }, link: null },
  });
  assert.match(notice.subject, /Herinnering: factuur MNRV-2026-001/u);
  assert.match(notice.text, /€\s?121,00/u);
  assert.match(notice.text, /NL00 BANK 0123 4567 89/u, "the IBAN is shown in groups of four");
  assert.match(notice.text, /iDEAL/u);
  assert.match(notice.html, /Onderhoud &lt;script&gt;/u);
  assert.doesNotMatch(notice.html, /<script>/u);
});

test("several invoices go out as one notice with subtotal, VAT and total added up separately", () => {
  const notice = buildDeveloperInvoiceNotice({
    kind: "READY",
    invoices: [
      { number: "F-1", title: "Hosting", subtotalCents: 10_000, vatCents: 2_100, totalCents: 12_100, issueDate: new Date("2026-09-01T12:00:00Z"), dueDate: new Date("2026-09-20T12:00:00Z") },
      { number: "F-2", title: "Onderhoud", subtotalCents: 5_000, vatCents: 1_050, totalCents: 6_050, issueDate: new Date("2026-09-02T12:00:00Z"), dueDate: new Date("2026-09-16T12:00:00Z") },
    ],
    developerName: "MNRV",
    invoiceUrl: "https://denotenman.com/admin/ontwikkelaarsfacturen",
    payment: { stripe: true, bankTransfer: { iban: "NL00BANK0123456789", accountHolder: "MNRV" }, link: null },
  });
  assert.equal(notice.subject, "2 nieuwe facturen van MNRV staan klaar");
  assert.match(notice.text, /Subtotaal: €\s?150,00/u);
  assert.match(notice.text, /Btw: €\s?31,50/u);
  assert.match(notice.text, /Totaal: €\s?181,50/u);
  assert.match(notice.text, /onder vermelding van F-1, F-2/u);
  assert.match(notice.text, /16 september 2026/u, "the earliest due date counts");
});
