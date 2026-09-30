import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import type { AftersalesMailPayload } from "../lib/aftersales/provider";
import { prisma } from "../lib/prisma";
import {
  cancelDeveloperInvoice,
  confirmDeveloperInvoiceCheckout,
  createDeveloperInvoice,
  deleteDeveloperInvoice,
  getDeveloperInvoice,
  listDeveloperInvoices,
  processDeveloperInvoiceReminders,
  sendDeveloperInvoice,
  startDeveloperInvoiceCheckout,
  updateDeveloperInvoice,
  updateDeveloperProfile,
  type DeveloperInvoiceDeps,
} from "../lib/developer-portal/service";

const day = 24 * 60 * 60 * 1000;
const createdIds: string[] = [];
let savedProfile: unknown = null;
const previousSecret = process.env.ADMIN_SESSION_SECRET;

const allSent: AftersalesMailPayload[] = [];
// Other invoices in the database may be processed too; only look at this test's mail.
const ours = () => allSent.filter((payload) => createdIds.some((id) => payload.deliveryId.includes(id)));
let clock = new Date("2099-03-01T09:00:00.000Z");
const deps: DeveloperInvoiceDeps = {
  now: () => clock,
  sendMail: async (payload) => {
    allSent.push(payload);
    return { provider: "RESEND_FALLBACK", messageId: `msg-${allSent.length}`, providerStatus: "accepted" };
  },
};

// Stripe is mocked: the key check, session creation and session retrieval.
let sessionPaid = false;
const stripeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/checkout/sessions?limit=1")) return Response.json({ data: [] });
  if (url.endsWith("/checkout/sessions") && init?.method === "POST") {
    const form = new URLSearchParams(String(init.body));
    return Response.json({ id: "cs_test_abc123", url: "https://checkout.stripe.com/c/pay/cs_test_abc123", payment_status: "unpaid", status: "open", metadata: { developer_invoice_id: form.get("metadata[developer_invoice_id]") } });
  }
  if (url.includes("/checkout/sessions/cs_test_abc123")) {
    const invoiceId = createdIds[0];
    return Response.json({ id: "cs_test_abc123", url: null, payment_status: sessionPaid ? "paid" : "unpaid", status: sessionPaid ? "complete" : "open", metadata: { developer_invoice_id: invoiceId } });
  }
  return new Response("not mocked", { status: 500 });
};

const invoiceInput = (title: string) => ({
  title,
  issueDate: "2099-03-01",
  paymentTermDays: 14,
  lines: [
    { description: "Ontwikkeling webshop", quantity: 12.5, unitPriceCents: 8_000, vatRate: 21 as const },
    { description: "Hosting maart", quantity: 1, unitPriceCents: 2_500, vatRate: 21 as const },
  ],
  notes: "Dank voor de fijne samenwerking.",
});

before(async () => {
  process.env.ADMIN_SESSION_SECRET ||= "integration-test-admin-secret";
  savedProfile = await prisma.developerBillingProfile.findUnique({ where: { id: "default" } });
  await updateDeveloperProfile({
    businessName: "MNRV",
    contactName: "Test Ontwikkelaar",
    email: "dev@example.com",
    address: "Straat 1",
    postalCode: "1234 AB",
    city: "Plaats",
    country: "Nederland",
    kvkNumber: "12345678",
    vatNumber: "NL000000000B01",
    paymentTermDays: 14,
    notificationEmail: "fedor@example.com",
    bankTransferEnabled: true,
    iban: "nl00 bank 0123 4567 89",
    bic: "BANKNL2A",
    accountHolder: "MNRV",
    stripeEnabled: true,
    stripeSecretKey: "rk_test_51AbCdEfGhIjKlMnOpQr",
    paymentLinkEnabled: false,
    paymentLinkUrl: "",
    paymentLinkLabel: "",
  }, { stripeFetch });
});

after(async () => {
  await prisma.developerInvoice.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.developerBillingProfile.deleteMany({ where: { id: "default" } });
  if (savedProfile) await prisma.developerBillingProfile.create({ data: savedProfile as never });
  process.env.ADMIN_SESSION_SECRET = previousSecret;
});

test("a draft is numbered, totalled and only editable while it is a draft", async () => {
  const draft = await createDeveloperInvoice(invoiceInput("Onderhoud maart"));
  createdIds.push(draft.id);
  assert.match(draft.number, /^MNRV-2099-\d{3}$/u);
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.subtotalCents, 102_500);
  assert.equal(draft.vatCents, 21_525);
  assert.equal(draft.totalCents, 124_025);
  assert.equal(draft.dueDate.slice(0, 10), "2099-03-15");

  const edited = await updateDeveloperInvoice(draft.id, { ...invoiceInput("Onderhoud maart (aangepast)"), paymentTermDays: 30 });
  assert.equal(edited.title, "Onderhoud maart (aangepast)");
  assert.equal(edited.dueDate.slice(0, 10), "2099-03-31");
  assert.equal((await listDeveloperInvoices({ publishedOnly: true })).some((invoice) => invoice.id === draft.id), false, "De Notenman does not see drafts");
});

test("setting an invoice ready notifies De Notenman once, then the reminders run on schedule", async () => {
  const id = createdIds[0];
  const ready = await sendDeveloperInvoice(id, deps);
  assert.equal(ready.status, "SENT");
  const sent = ours();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "fedor@example.com");
  assert.match(sent[0].subject, /Nieuwe factuur MNRV-2099-\d{3} van MNRV staat klaar/u);
  assert.match(sent[0].text, /NL00 BANK 0123 4567 89/u, "the IBAN is shown in groups of four");
  await assert.rejects(sendDeveloperInvoice(id, deps), (error: Error & { code?: string }) => error.code === "INVOICE_NOT_SENDABLE");
  await assert.rejects(updateDeveloperInvoice(id, invoiceInput("Te laat")), (error: Error & { code?: string }) => error.code === "INVOICE_NOT_EDITABLE");

  const run = () => processDeveloperInvoiceReminders({ ...deps, stripeFetch });

  clock = new Date(clock.getTime() + 6 * day);
  await run();
  assert.equal(ours().length, 1, "no reminder before day 7");

  clock = new Date(clock.getTime() + 1 * day);
  await run();
  assert.equal(ours().length, 2);
  assert.match(ours().at(-1)!.subject, /^Herinnering/u);
  await run();
  assert.equal(ours().length, 2, "a reminder is sent once");

  clock = new Date(clock.getTime() + 14 * day);
  await run();
  assert.equal(ours().length, 3);
  assert.match(ours().at(-1)!.subject, /^Tweede herinnering/u);

  clock = new Date(clock.getTime() + 60 * day);
  await run();
  assert.equal(ours().length, 3, "no third reminder");
});

test("paying with Stripe marks the invoice paid only once Stripe confirms it", async () => {
  const id = createdIds[0];
  const checkout = await startDeveloperInvoiceCheckout(id, { stripeFetch });
  assert.match(checkout.url, /^https:\/\/checkout\.stripe\.com\//u);

  assert.equal(await confirmDeveloperInvoiceCheckout(id, "cs_test_abc123", { stripeFetch }), false, "unpaid session changes nothing");
  assert.equal((await getDeveloperInvoice(id)).status, "SENT");

  sessionPaid = true;
  await processDeveloperInvoiceReminders({ ...deps, stripeFetch });
  const paid = await getDeveloperInvoice(id);
  assert.equal(paid.status, "PAID", "the reminder run picks up the payment");
  assert.equal(paid.paidVia, "stripe");
  assert.deepEqual(paid.events.map((event) => event.type).filter((type) => type !== "UPDATED"), [
    "CREATED", "SENT", "EMAIL_READY", "EMAIL_FIRST_REMINDER", "EMAIL_SECOND_REMINDER", "CHECKOUT_STARTED", "PAID",
  ]);
  await assert.rejects(cancelDeveloperInvoice(id), (error: Error & { code?: string }) => error.code === "INVOICE_NOT_CANCELLABLE");
});

test("only drafts can be deleted; sent invoices are cancelled instead", async () => {
  const draft = await createDeveloperInvoice(invoiceInput("Tweede factuur"));
  createdIds.push(draft.id);
  await sendDeveloperInvoice(draft.id, deps);
  await assert.rejects(deleteDeveloperInvoice(draft.id), (error: Error & { code?: string }) => error.code === "INVOICE_NOT_DELETABLE");
  assert.equal((await cancelDeveloperInvoice(draft.id)).status, "CANCELLED");

  const third = await createDeveloperInvoice(invoiceInput("Derde factuur"));
  await deleteDeveloperInvoice(third.id);
  assert.equal(await prisma.developerInvoice.count({ where: { id: third.id } }), 0);
});
