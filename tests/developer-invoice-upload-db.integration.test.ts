import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import type { AftersalesMailPayload } from "../lib/aftersales/provider";
import { prisma } from "../lib/prisma";
import {
  confirmDeveloperInvoiceSession,
  createDeveloperInvoiceFromUpload,
  getDeveloperInvoice,
  getDeveloperInvoiceAttachment,
  processDeveloperInvoiceReminders,
  sendDeveloperInvoices,
  startDeveloperInvoicesCheckout,
  updateDeveloperProfile,
  type DeveloperInvoiceDeps,
} from "../lib/developer-portal/service";

const run = randomUUID().slice(0, 8);
const ids: string[] = [];
let savedProfile: unknown = null;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
const pdf = Buffer.from("%PDF-1.7 test invoice");

const sent: AftersalesMailPayload[] = [];
let clock = new Date("2098-05-01T09:00:00.000Z");
const deps: DeveloperInvoiceDeps = {
  now: () => clock,
  sendMail: async (payload) => {
    sent.push(payload);
    return { provider: "RESEND_FALLBACK", messageId: `msg-${sent.length}`, providerStatus: "accepted" };
  },
};
const ours = () => sent.filter((payload) => payload.text.includes(run));

function reading(number: string, subtotal: number, vatRate: number, currency = "EUR") {
  const vat = Math.round(subtotal * vatRate) / 100;
  return async () => ({
    text: JSON.stringify({
      isInvoice: true,
      invoiceNumber: number,
      issueDate: "2098-05-01",
      dueDate: "2098-05-15",
      description: `Werk ${run}`,
      currency,
      lines: [{ description: `Werk ${run}`, amountExclVat: subtotal, vatRatePercent: vatRate }],
      subtotalExclVat: subtotal,
      vatAmount: vat,
      totalInclVat: subtotal + vat,
    }),
  });
}

let checkoutForm: URLSearchParams | null = null;
let sessionPaid = false;
const stripeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/checkout/sessions?limit=1")) return Response.json({ data: [] });
  if (url.endsWith("/checkout/sessions") && init?.method === "POST") {
    checkoutForm = new URLSearchParams(String(init.body));
    return Response.json({ id: `cs_test_multi${run}`, url: "https://checkout.stripe.com/c/pay/multi", payment_status: "unpaid", status: "open", metadata: { developer_invoice_ids: checkoutForm.get("metadata[developer_invoice_ids]") } });
  }
  if (url.includes(`/checkout/sessions/cs_test_multi${run}`)) {
    return Response.json({ id: `cs_test_multi${run}`, url: null, payment_status: sessionPaid ? "paid" : "unpaid", status: "complete", metadata: { developer_invoice_ids: checkoutForm?.get("metadata[developer_invoice_ids]") } });
  }
  return new Response("not mocked", { status: 500 });
};

async function upload(number: string, subtotal: number, vatRate = 21) {
  const result = await createDeveloperInvoiceFromUpload({ filename: `factuur-${number}.pdf`, contentType: "application/pdf", bytes: pdf }, { ...deps, generate: reading(number, subtotal, vatRate) });
  ids.push(result.invoice.id);
  return result;
}

before(async () => {
  process.env.ADMIN_SESSION_SECRET ||= "integration-test-admin-secret";
  savedProfile = await prisma.developerBillingProfile.findUnique({ where: { id: "default" } });
  await updateDeveloperProfile({
    businessName: "MNRV", contactName: "", email: "", address: "", postalCode: "", city: "", country: "Nederland", kvkNumber: "", vatNumber: "",
    paymentTermDays: 14, notificationEmail: "fedor@example.com", bankTransferEnabled: true, iban: "NL00BANK0123456789", bic: "", accountHolder: "MNRV",
    stripeEnabled: true, stripeSecretKey: "rk_test_51AbCdEfGhIjKlMnOpQr", paymentLinkEnabled: false, paymentLinkUrl: "", paymentLinkLabel: "",
  }, { stripeFetch });
});

after(async () => {
  await prisma.developerInvoice.deleteMany({ where: { id: { in: ids } } });
  await prisma.developerBillingProfile.deleteMany({ where: { id: "default" } });
  if (savedProfile) await prisma.developerBillingProfile.create({ data: savedProfile as never });
  process.env.ADMIN_SESSION_SECRET = previousSecret;
});

test("an uploaded invoice becomes a draft with the printed number, amounts and the original file", async () => {
  const { invoice, warnings } = await upload(`A-${run}`, 875);
  assert.equal(invoice.status, "DRAFT");
  assert.equal(invoice.number, `A-${run}`);
  assert.equal(invoice.subtotalCents, 87_500);
  assert.equal(invoice.vatCents, 18_375);
  assert.equal(invoice.totalCents, 105_875);
  assert.equal(invoice.dueDate.slice(0, 10), "2098-05-15");
  assert.deepEqual(warnings, []);
  assert.equal(invoice.attachment?.filename, `factuur-A-${run}.pdf`);
  assert.equal(invoice.attachment?.printedTotalCents, 105_875);

  // De Notenman cannot open a draft's file; the developer can.
  await assert.rejects(getDeveloperInvoiceAttachment(invoice.id, { publishedOnly: true }), (error: Error & { code?: string }) => error.code === "ATTACHMENT_NOT_FOUND");
  const file = await getDeveloperInvoiceAttachment(invoice.id);
  assert.equal(file.data.toString(), "%PDF-1.7 test invoice");
});

test("uploading the same invoice number twice gets its own number and a warning", async () => {
  const { invoice, warnings } = await upload(`A-${run}`, 100);
  assert.notEqual(invoice.number, `A-${run}`);
  assert.match(warnings.join(), /bestaat al/u);
});

test("several invoices are set ready with one notice that adds up subtotal, VAT and total", async () => {
  const second = await upload(`B-${run}`, 100, 9);
  const before = ours().length;
  const ready = await sendDeveloperInvoices([ids[0], second.invoice.id], deps);
  assert.ok(ready.every((invoice) => invoice.status === "SENT"));
  const notices = ours().slice(before);
  assert.equal(notices.length, 1, "one e-mail for both");
  assert.match(notices[0].subject, /^2 nieuwe facturen van MNRV staan klaar$/u);
  assert.match(notices[0].text, /Subtotaal: €\s?975,00/u);
  assert.match(notices[0].text, /Btw: €\s?192,75/u);
  assert.match(notices[0].text, /Totaal: €\s?1\.167,75/u);
  await getDeveloperInvoiceAttachment(ids[0], { publishedOnly: true });
});

test("one Stripe payment covers the selected invoices and marks them all paid", async () => {
  const open = [ids[0], ids[2]];
  const checkout = await startDeveloperInvoicesCheckout(open, "overview", { stripeFetch });
  assert.equal(checkout.url, "https://checkout.stripe.com/c/pay/multi");
  const form = checkoutForm!;
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "105875");
  assert.equal(form.get("line_items[1][price_data][unit_amount]"), "10900");
  assert.deepEqual(form.get("metadata[developer_invoice_ids]")!.split(",").sort(), [...open].sort(), "both ids travel along");
  assert.match(form.get("success_url") ?? "", /\/admin\/ontwikkelaarsfacturen\?betaling=gelukt/u);

  assert.deepEqual(await confirmDeveloperInvoiceSession(`cs_test_multi${run}`, { stripeFetch }), [], "unpaid changes nothing");
  sessionPaid = true;
  assert.deepEqual((await confirmDeveloperInvoiceSession(`cs_test_multi${run}`, { stripeFetch })).sort(), [...open].sort());
  for (const id of open) {
    const invoice = await getDeveloperInvoice(id);
    assert.equal(invoice.status, "PAID");
    assert.equal(invoice.paidVia, "stripe");
  }
});

test("due reminders for several invoices go out as one e-mail", async () => {
  const third = await upload(`C-${run}`, 50);
  const fourth = await upload(`D-${run}`, 60);
  await sendDeveloperInvoices([third.invoice.id, fourth.invoice.id], deps);
  const before = ours().length;
  clock = new Date(clock.getTime() + 7 * 24 * 60 * 60 * 1000);
  await processDeveloperInvoiceReminders({ ...deps, stripeFetch });
  const reminders = ours().slice(before);
  assert.equal(reminders.length, 1);
  assert.match(reminders[0].subject, /^Herinnering: 2 facturen staan nog open$/u);
  assert.match(reminders[0].text, new RegExp(`C-${run}`, "u"));
  assert.match(reminders[0].text, new RegExp(`D-${run}`, "u"));
});

test("a dollar invoice is converted to euros at the ECB rate of its date, with the original kept", async () => {
  const result = await createDeveloperInvoiceFromUpload(
    { filename: "aws.pdf", contentType: "application/pdf", bytes: pdf },
    { ...deps, generate: reading(`USD-${run}`, 112.98, 0, "USD"), rateFor: async (currency, date) => ({ currency, rate: 1.1298, rateDate: date }) },
  );
  ids.push(result.invoice.id);
  const invoice = result.invoice;
  assert.equal(invoice.totalCents, 10_000, "$ 112,98 at 1,1298 is € 100,00");
  assert.equal(invoice.vatCents, 0);
  assert.match(invoice.lines[0].description, /\(\$ 112,98\)$/u);
  assert.match(invoice.notes ?? "", /Omgerekend van \$ 112,98 tegen de ECB-koers van 1 mei 2098: 1 euro = 1,1298 dollar\./u);
  assert.deepEqual(invoice.attachment?.conversion, { currency: "USD", rate: 1.1298, rateDate: "2098-05-01", originalTotalCents: 11_298 });
  assert.equal(invoice.attachment?.printedTotalCents, 10_000, "the printed total is compared in euros");
});
