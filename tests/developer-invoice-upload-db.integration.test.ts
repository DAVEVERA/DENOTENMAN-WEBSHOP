import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import type { AftersalesMailPayload } from "../lib/aftersales/provider";
import { sealSecret } from "../lib/developer-portal/secret-box";
import { prisma } from "../lib/prisma";
import {
  confirmDeveloperInvoiceSession,
  createDeveloperInvoiceFromUpload,
  getDeveloperInvoice,
  getDeveloperInvoiceAttachment,
  handleDeveloperStripeWebhook,
  listDeveloperDevices,
  listDeveloperInvoiceViews,
  recordDeveloperInvoiceView,
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

test("a signed Stripe webhook marks the invoices of a paid session paid, a forged one does nothing", async () => {
  const fifth = await upload(`E-${run}`, 70);
  await sendDeveloperInvoices([fifth.invoice.id], deps);
  await startDeveloperInvoicesCheckout([fifth.invoice.id], "overview", { stripeFetch });
  const webhookSecret = "whsec_integration_test";
  await prisma.developerBillingProfile.update({ where: { id: "default" }, data: { stripeWebhookEndpointId: "we_test", stripeWebhookSecretEncrypted: sealSecret(webhookSecret) } });
  const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: `cs_test_multi${run}`, object: "checkout.session" } } });
  const at = Math.floor(clock.getTime() / 1000);
  const signature = (key: string) => `t=${at},v1=${createHmac("sha256", key).update(`${at}.${payload}`).digest("hex")}`;

  assert.deepEqual(await handleDeveloperStripeWebhook(payload, signature("whsec_forged"), { ...deps, stripeFetch }), { ok: false, paid: [] });
  assert.equal((await getDeveloperInvoice(fifth.invoice.id)).status, "SENT");

  const result = await handleDeveloperStripeWebhook(payload, signature(webhookSecret), { ...deps, stripeFetch });
  assert.equal(result.ok, true);
  assert.deepEqual(result.paid, [fifth.invoice.id]);
  const invoice = await getDeveloperInvoice(fifth.invoice.id);
  assert.equal(invoice.status, "PAID");
  assert.equal(invoice.paidVia, "stripe");
});

test("views by De Notenman are recorded once per visit and shown with the invoice", async () => {
  const admin = await prisma.adminUser.create({ data: { username: `viewer-${run}`, passwordHash: "x", name: `Fedor ${run}` } });
  try {
    const invoiceId = ids[0];
    const iphone = {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1",
      forwardedFor: "2a02:a420:243f:1:2:3:4:5, 10.0.0.1",
      screen: { width: 393, height: 852, pixelRatio: 3 },
    };
    assert.equal(await recordDeveloperInvoiceView({ kind: "INVOICE", adminUserId: admin.id, invoiceId, client: iphone }, deps), true);
    assert.equal(await recordDeveloperInvoiceView({ kind: "INVOICE", adminUserId: admin.id, invoiceId, client: iphone }, deps), false, "a reload is the same visit");
    const laptop = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", forwardedFor: "84.29.10.20" };
    assert.equal(await recordDeveloperInvoiceView({ kind: "INVOICE", adminUserId: admin.id, invoiceId, client: laptop }, deps), true, "another device on the same login is its own visit");
    assert.equal(await recordDeveloperInvoiceView({ kind: "OVERVIEW", adminUserId: admin.id }, deps), true);
    clock = new Date(clock.getTime() + 16 * 60 * 1000);
    assert.equal(await recordDeveloperInvoiceView({ kind: "INVOICE", adminUserId: admin.id, invoiceId, client: iphone }, deps), true, "a later visit counts again");

    const invoice = await getDeveloperInvoice(invoiceId);
    assert.equal(invoice.views?.count, 3);
    assert.equal(invoice.views?.lastBy, `Fedor ${run}`);
    assert.equal(invoice.views?.lastAt, clock.toISOString());
    assert.equal((await getDeveloperInvoice(invoiceId, { publishedOnly: true })).views, null, "De Notenman's pages never get the views");

    const mine = (await listDeveloperInvoiceViews(500)).filter((view) => view.viewerName === `Fedor ${run}`);
    assert.deepEqual(mine.map((view) => view.kind).sort(), ["INVOICE", "INVOICE", "INVOICE", "OVERVIEW"]);
    const phoneView = mine.find((view) => view.device === "iPhone")!;
    assert.equal(phoneView.invoiceNumber, invoice.number);
    assert.equal(phoneView.deviceModel, "iPhone 14 Pro/15/15 Pro of 16");
    assert.equal(phoneView.os, "iOS 26.6");
    assert.equal(phoneView.network, "2a02:a420:243f::/48");

    const devices = await listDeveloperDevices();
    const phone = devices.find((device) => device.deviceModel === "iPhone 14 Pro/15/15 Pro of 16" && device.screen === "393×852 @3x");
    assert.ok(phone, "the iPhone is listed as a device");
    assert.ok(phone.visits >= 2);
    assert.ok(devices.some((device) => device.device === "Windows-pc" && device.networks.includes("84.29.10.0/24")));
  } finally {
    await prisma.developerInvoiceView.deleteMany({ where: { adminUserId: admin.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
  }
});

test("a file the AI cannot read still becomes a draft with the original attached, and cannot be sent empty", async () => {
  const result = await createDeveloperInvoiceFromUpload(
    // The browser sent no file type at all, which used to be refused.
    { filename: `scan_oktober_${run}.pdf`, contentType: "", bytes: pdf },
    { ...deps, generate: async () => ({ text: "geen json" }) },
  );
  ids.push(result.invoice.id);
  assert.equal(result.invoice.status, "DRAFT");
  assert.equal(result.invoice.totalCents, 0);
  assert.equal(result.invoice.title, `scan oktober ${run}`);
  assert.equal(result.invoice.attachment?.contentType, "application/pdf");
  assert.equal(result.invoice.attachment?.filename, `scan_oktober_${run}.pdf`);
  assert.match(result.warnings[0], /Automatisch uitlezen is niet gelukt/u);
  assert.deepEqual(result.invoice.attachment?.warnings, result.warnings);
  await assert.rejects(sendDeveloperInvoices([result.invoice.id], deps), (error: Error & { code?: string }) => error.code === "INVOICE_EMPTY");
});

test("an AI outage or a missing exchange rate also gives a draft instead of an error", async () => {
  const { InvoiceExtractionError } = await import("../lib/developer-portal/extract");
  const { ExchangeRateError } = await import("../lib/developer-portal/fx");
  const outage = await createDeveloperInvoiceFromUpload(
    { filename: `drukte-${run}.pdf`, contentType: "application/pdf", bytes: pdf },
    { ...deps, generate: async () => { throw new InvoiceExtractionError("AI_UNAVAILABLE", "De AI is nu te druk om de factuur uit te lezen.", 503); } },
  );
  ids.push(outage.invoice.id);
  assert.equal(outage.invoice.totalCents, 0);
  assert.match(outage.warnings[0], /te druk/u);

  const noRate = await createDeveloperInvoiceFromUpload(
    { filename: `dollar-${run}.pdf`, contentType: "application/pdf", bytes: pdf },
    { ...deps, generate: reading(`NR-${run}`, 100, 0, "USD"), rateFor: async () => { throw new ExchangeRateError("RATE_UNAVAILABLE", "geen koers"); } },
  );
  ids.push(noRate.invoice.id);
  assert.equal(noRate.invoice.totalCents, 0);
  assert.equal(noRate.invoice.number, `NR-${run}`, "the printed number is kept");
  assert.match(noRate.warnings[0], /dollarkoers/u);
});

test("an invoice with a foreign VAT rate keeps its total through a separate VAT line", async () => {
  const { invoice, warnings } = await upload(`DE-${run}`, 100, 19);
  assert.equal(invoice.subtotalCents, 11_900, "amount plus the 19% VAT as its own line");
  assert.equal(invoice.vatCents, 0);
  assert.equal(invoice.totalCents, 11_900);
  assert.ok(warnings.some((warning) => /19% btw/u.test(warning)));
});
