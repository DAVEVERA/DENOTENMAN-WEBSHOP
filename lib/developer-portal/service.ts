import "server-only";
import { Prisma, type DeveloperBillingProfile, type DeveloperInvoice } from "@prisma/client";
import { z } from "zod";

import { sendAftersalesMail } from "@/lib/aftersales/provider";
import { merchantOrderNotificationRecipient } from "@/lib/merchant-order-notification";
import { prisma } from "@/lib/prisma";
import { BASE_URL } from "@/lib/routes";
import {
  computeDeveloperInvoiceTotals,
  developerInvoiceInputSchema,
  developerInvoiceLineSchema,
  dueDateFor,
  dueReminder,
  formatDeveloperInvoiceNumber,
  invoiceDateFromInput,
  type DeveloperInvoiceInput,
  type DeveloperInvoiceLine,
} from "./invoice-math";
import { buildDeveloperInvoiceNotice, type DeveloperInvoiceNoticeKind } from "./notifications";
import { openSecret, sealSecret } from "./secret-box";
import {
  createStripeCheckoutSession,
  DeveloperStripeError,
  looksLikeStripeSecretKey,
  retrieveStripeCheckoutSession,
  verifyStripeKey,
} from "./stripe";

export class DeveloperInvoiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "DeveloperInvoiceError";
  }
}

export type DeveloperInvoiceDeps = {
  now: () => Date;
  sendMail: typeof sendAftersalesMail;
  stripeFetch?: typeof fetch;
};

const defaultDeps: DeveloperInvoiceDeps = { now: () => new Date(), sendMail: sendAftersalesMail };

const PROFILE_ID = "default";

// ---------- Billing profile ----------

export const developerProfileInputSchema = z.object({
  businessName: z.string().trim().max(160),
  contactName: z.string().trim().max(160),
  email: z.string().trim().max(320).refine((value) => value === "" || z.string().email().safeParse(value).success, "Gebruik een geldig e-mailadres."),
  address: z.string().trim().max(200),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().max(120),
  country: z.string().trim().max(80),
  kvkNumber: z.string().trim().max(20),
  vatNumber: z.string().trim().max(30),
  paymentTermDays: z.number().int().min(0).max(120),
  notificationEmail: z.string().trim().max(320).refine((value) => value === "" || z.string().email().safeParse(value).success, "Gebruik een geldig e-mailadres."),
  bankTransferEnabled: z.boolean(),
  iban: z.string().trim().max(40).transform((value) => value.replace(/\s+/gu, "").toUpperCase()),
  bic: z.string().trim().max(20),
  accountHolder: z.string().trim().max(160),
  stripeEnabled: z.boolean(),
  /** Empty keeps the stored key; a new key replaces it. */
  stripeSecretKey: z.string().trim().max(300).optional(),
  removeStripeKey: z.boolean().optional(),
  paymentLinkEnabled: z.boolean(),
  paymentLinkUrl: z.string().trim().max(500).refine((value) => value === "" || /^https:\/\/\S+$/u.test(value), "Gebruik een https-link."),
  paymentLinkLabel: z.string().trim().max(80),
}).strict();

export type DeveloperProfileInput = z.input<typeof developerProfileInputSchema>;

export type DeveloperProfileDto = Omit<DeveloperBillingProfile, "stripeSecretKeyEncrypted" | "updatedAt"> & {
  stripeKeyConfigured: boolean;
  /** False when a stored key can no longer be decrypted and must be entered again. */
  stripeKeyReadable: boolean;
  stripeKeyHint: string | null;
  stripeKeyMode: "live" | "test" | null;
  updatedAt: string;
};

export async function getDeveloperProfile(): Promise<DeveloperBillingProfile> {
  return prisma.developerBillingProfile.upsert({ where: { id: PROFILE_ID }, update: {}, create: { id: PROFILE_ID } });
}

export function developerProfileDto(profile: DeveloperBillingProfile): DeveloperProfileDto {
  const { stripeSecretKeyEncrypted, updatedAt, ...rest } = profile;
  const key = openSecret(stripeSecretKeyEncrypted);
  return {
    ...rest,
    stripeKeyConfigured: Boolean(stripeSecretKeyEncrypted),
    stripeKeyReadable: Boolean(key),
    stripeKeyHint: key ? `…${key.slice(-4)}` : null,
    stripeKeyMode: key ? (key.includes("_live_") ? "live" : "test") : null,
    updatedAt: updatedAt.toISOString(),
  };
}

export async function updateDeveloperProfile(candidate: unknown, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<DeveloperProfileDto> {
  const { stripeSecretKey, removeStripeKey, ...fields } = developerProfileInputSchema.parse(candidate);
  const input = fields;
  const current = await getDeveloperProfile();
  let stripeSecretKeyEncrypted = current.stripeSecretKeyEncrypted;
  if (removeStripeKey) stripeSecretKeyEncrypted = null;
  if (stripeSecretKey) {
    if (!looksLikeStripeSecretKey(stripeSecretKey)) {
      throw new DeveloperInvoiceError("STRIPE_KEY_FORMAT", "Dit lijkt geen Stripe secret key (sk_…) of restricted key (rk_…).", 422);
    }
    await verifyStripeKey(stripeSecretKey, deps.stripeFetch);
    stripeSecretKeyEncrypted = sealSecret(stripeSecretKey);
  }
  if (input.stripeEnabled && !stripeSecretKeyEncrypted) {
    throw new DeveloperInvoiceError("STRIPE_KEY_MISSING", "Vul eerst een Stripe-sleutel in om Stripe aan te zetten.", 422);
  }
  if (input.bankTransferEnabled && (!input.iban || !input.accountHolder)) {
    throw new DeveloperInvoiceError("BANK_DETAILS_MISSING", "Vul IBAN en tenaamstelling in om overmaken aan te bieden.", 422);
  }
  if (input.paymentLinkEnabled && !input.paymentLinkUrl) {
    throw new DeveloperInvoiceError("PAYMENT_LINK_MISSING", "Vul een betaallink in of zet deze optie uit.", 422);
  }
  const saved = await prisma.developerBillingProfile.update({
    where: { id: PROFILE_ID },
    data: { ...fields, stripeSecretKeyEncrypted },
  });
  return developerProfileDto(saved);
}

// ---------- Invoices ----------

export type DeveloperInvoiceDto = {
  id: string;
  number: string;
  title: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lines: DeveloperInvoiceLine[];
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  vatByRate: Array<{ rate: number; baseCents: number; vatCents: number }>;
  notes: string | null;
  status: DeveloperInvoice["status"];
  overdue: boolean;
  sentAt: string | null;
  firstReminderAt: string | null;
  secondReminderAt: string | null;
  paidAt: string | null;
  paidVia: string | null;
  events: Array<{ type: string; createdAt: string; detail: unknown }>;
};

function storedLines(value: Prisma.JsonValue): DeveloperInvoiceLine[] {
  const parsed = z.array(developerInvoiceLineSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function developerInvoiceDto(
  invoice: DeveloperInvoice & { events?: Array<{ type: string; createdAt: Date; detail: Prisma.JsonValue }> },
  now = new Date(),
): DeveloperInvoiceDto {
  const lines = storedLines(invoice.lines);
  return {
    id: invoice.id,
    number: invoice.number,
    title: invoice.title,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    currency: invoice.currency,
    lines,
    subtotalCents: invoice.subtotalCents,
    vatCents: invoice.vatCents,
    totalCents: invoice.totalCents,
    vatByRate: computeDeveloperInvoiceTotals(lines).vatByRate,
    notes: invoice.notes,
    status: invoice.status,
    overdue: invoice.status === "SENT" && invoice.dueDate.getTime() < now.getTime(),
    sentAt: invoice.sentAt?.toISOString() ?? null,
    firstReminderAt: invoice.firstReminderAt?.toISOString() ?? null,
    secondReminderAt: invoice.secondReminderAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    paidVia: invoice.paidVia,
    events: (invoice.events ?? []).map((event) => ({ type: event.type, createdAt: event.createdAt.toISOString(), detail: event.detail })),
  };
}

function invoiceData(input: DeveloperInvoiceInput) {
  const totals = computeDeveloperInvoiceTotals(input.lines);
  const issueDate = invoiceDateFromInput(input.issueDate);
  return {
    title: input.title,
    issueDate,
    dueDate: dueDateFor(issueDate, input.paymentTermDays),
    lines: input.lines as Prisma.InputJsonValue,
    subtotalCents: totals.subtotalCents,
    vatCents: totals.vatCents,
    totalCents: totals.totalCents,
    notes: input.notes || null,
  };
}

async function nextInvoiceNumber(year: number): Promise<string> {
  const prefix = `MNRV-${year}-`;
  const latest = await prisma.developerInvoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const sequence = latest ? Number(latest.number.slice(prefix.length)) + 1 : 1;
  return formatDeveloperInvoiceNumber(year, Number.isFinite(sequence) ? sequence : 1);
}

const withEvents = { events: { orderBy: { createdAt: "asc" as const } } };

export async function listDeveloperInvoices(options: { publishedOnly?: boolean } = {}): Promise<DeveloperInvoiceDto[]> {
  const invoices = await prisma.developerInvoice.findMany({
    where: options.publishedOnly ? { status: { in: ["SENT", "PAID"] } } : undefined,
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: withEvents,
  });
  return invoices.map((invoice) => developerInvoiceDto(invoice));
}

export async function getDeveloperInvoice(id: string, options: { publishedOnly?: boolean } = {}): Promise<DeveloperInvoiceDto> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id }, include: withEvents });
  if (!invoice || (options.publishedOnly && !["SENT", "PAID"].includes(invoice.status))) {
    throw new DeveloperInvoiceError("INVOICE_NOT_FOUND", "Deze factuur bestaat niet.", 404);
  }
  return developerInvoiceDto(invoice);
}

async function logEvent(invoiceId: string, type: string, detail?: Prisma.InputJsonValue) {
  await prisma.developerInvoiceEvent.create({ data: { invoiceId, type, detail } });
}

export async function createDeveloperInvoice(candidate: unknown): Promise<DeveloperInvoiceDto> {
  const input = developerInvoiceInputSchema.parse(candidate);
  const data = invoiceData(input);
  // A concurrent create can claim the same number; the unique index makes us retry.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invoice = await prisma.developerInvoice.create({
        data: { ...data, number: await nextInvoiceNumber(data.issueDate.getUTCFullYear()) },
      });
      await logEvent(invoice.id, "CREATED");
      return getDeveloperInvoice(invoice.id);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || attempt === 2) throw error;
    }
  }
  throw new DeveloperInvoiceError("NUMBER_CONFLICT", "Er kon geen factuurnummer worden toegekend.", 409);
}

export async function updateDeveloperInvoice(id: string, candidate: unknown): Promise<DeveloperInvoiceDto> {
  const input = developerInvoiceInputSchema.parse(candidate);
  const updated = await prisma.developerInvoice.updateMany({ where: { id, status: "DRAFT" }, data: invoiceData(input) });
  if (updated.count !== 1) throw new DeveloperInvoiceError("INVOICE_NOT_EDITABLE", "Alleen een concept kan worden aangepast.", 409);
  await logEvent(id, "UPDATED");
  return getDeveloperInvoice(id);
}

export async function deleteDeveloperInvoice(id: string): Promise<void> {
  const deleted = await prisma.developerInvoice.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count !== 1) throw new DeveloperInvoiceError("INVOICE_NOT_DELETABLE", "Alleen een concept kan worden verwijderd. Annuleer een verstuurde factuur.", 409);
}

function paymentSummary(profile: DeveloperBillingProfile) {
  return {
    stripe: profile.stripeEnabled && Boolean(openSecret(profile.stripeSecretKeyEncrypted)),
    bankTransfer: profile.bankTransferEnabled && profile.iban ? { iban: profile.iban, accountHolder: profile.accountHolder } : null,
    link: profile.paymentLinkEnabled && profile.paymentLinkUrl ? { url: profile.paymentLinkUrl, label: profile.paymentLinkLabel } : null,
  };
}

export function developerInvoiceUrl(id: string): string {
  return `${BASE_URL}/admin/ontwikkelaarsfacturen/${encodeURIComponent(id)}`;
}

async function sendNotice(invoice: DeveloperInvoice, kind: DeveloperInvoiceNoticeKind, deps: DeveloperInvoiceDeps) {
  const profile = await getDeveloperProfile();
  const to = profile.notificationEmail || merchantOrderNotificationRecipient();
  const notice = buildDeveloperInvoiceNotice({
    kind,
    invoice,
    developerName: profile.businessName || profile.contactName,
    invoiceUrl: developerInvoiceUrl(invoice.id),
    payment: paymentSummary(profile),
  });
  const result = await deps.sendMail({
    deliveryId: `developer-invoice-${invoice.id}-${kind}`,
    orderId: "",
    trigger: "DEVELOPER_INVOICE",
    to,
    subject: notice.subject,
    html: notice.html,
    text: notice.text,
  });
  await logEvent(invoice.id, `EMAIL_${kind}`, { to, messageId: result.messageId });
}

/** Sets a draft ready: De Notenman gets an e-mail and sees the invoice in the admin. */
export async function sendDeveloperInvoice(id: string, deps: DeveloperInvoiceDeps = defaultDeps): Promise<DeveloperInvoiceDto> {
  const profile = await getDeveloperProfile();
  const methods = paymentSummary(profile);
  if (!methods.stripe && !methods.bankTransfer && !methods.link) {
    throw new DeveloperInvoiceError("NO_PAYMENT_METHOD", "Stel eerst minimaal één betaalmogelijkheid in.", 422);
  }
  const claimed = await prisma.developerInvoice.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENT", sentAt: deps.now() } });
  if (claimed.count !== 1) throw new DeveloperInvoiceError("INVOICE_NOT_SENDABLE", "Deze factuur is al verstuurd of geannuleerd.", 409);
  await logEvent(id, "SENT");
  const invoice = await prisma.developerInvoice.findUniqueOrThrow({ where: { id } });
  try {
    await sendNotice(invoice, "READY", deps);
  } catch (error) {
    // The invoice is visible in the admin either way; the next reminder run retries nothing,
    // so the failure is logged for the developer to see and resend.
    await logEvent(id, "EMAIL_FAILED", { kind: "READY", message: error instanceof Error ? error.message : String(error) });
  }
  return getDeveloperInvoice(id);
}

export async function resendDeveloperInvoiceNotice(id: string, deps: DeveloperInvoiceDeps = defaultDeps): Promise<DeveloperInvoiceDto> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id } });
  if (!invoice || invoice.status !== "SENT") throw new DeveloperInvoiceError("INVOICE_NOT_OPEN", "Alleen een openstaande factuur kan opnieuw worden gemeld.", 409);
  await sendNotice(invoice, "READY", { ...deps, sendMail: (payload) => deps.sendMail({ ...payload, deliveryId: `${payload.deliveryId}-${deps.now().getTime()}` }) });
  return getDeveloperInvoice(id);
}

export async function cancelDeveloperInvoice(id: string): Promise<DeveloperInvoiceDto> {
  const cancelled = await prisma.developerInvoice.updateMany({ where: { id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "CANCELLED" } });
  if (cancelled.count !== 1) throw new DeveloperInvoiceError("INVOICE_NOT_CANCELLABLE", "Een betaalde factuur kan niet worden geannuleerd.", 409);
  await logEvent(id, "CANCELLED");
  return getDeveloperInvoice(id);
}

export async function markDeveloperInvoicePaid(id: string, via: string, deps: Pick<DeveloperInvoiceDeps, "now"> = defaultDeps): Promise<DeveloperInvoiceDto> {
  const paid = await prisma.developerInvoice.updateMany({ where: { id, status: "SENT" }, data: { status: "PAID", paidAt: deps.now(), paidVia: via } });
  if (paid.count === 1) await logEvent(id, "PAID", { via });
  else {
    const invoice = await prisma.developerInvoice.findUnique({ where: { id }, select: { status: true } });
    if (invoice?.status !== "PAID") throw new DeveloperInvoiceError("INVOICE_NOT_OPEN", "Alleen een openstaande factuur kan als betaald worden gemarkeerd.", 409);
  }
  return getDeveloperInvoice(id);
}

// ---------- Paying with Stripe (De Notenman side) ----------

async function stripeKeyOrThrow(): Promise<string> {
  const profile = await getDeveloperProfile();
  const key = openSecret(profile.stripeSecretKeyEncrypted);
  if (!profile.stripeEnabled || !key) throw new DeveloperInvoiceError("STRIPE_NOT_AVAILABLE", "Online betalen is niet beschikbaar voor deze factuur.", 409);
  return key;
}

export async function startDeveloperInvoiceCheckout(id: string, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<{ url: string }> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id } });
  if (!invoice || invoice.status !== "SENT") throw new DeveloperInvoiceError("INVOICE_NOT_OPEN", "Deze factuur staat niet open.", 409);
  const secretKey = await stripeKeyOrThrow();
  const url = developerInvoiceUrl(id);
  const session = await createStripeCheckoutSession({
    secretKey,
    invoiceId: id,
    invoiceNumber: invoice.number,
    title: invoice.title,
    totalCents: invoice.totalCents,
    currency: invoice.currency,
    successUrl: `${url}?betaling=gelukt&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${url}?betaling=geannuleerd`,
  }, deps.stripeFetch);
  if (!session.url) throw new DeveloperInvoiceError("STRIPE_NO_URL", "Stripe gaf geen betaalpagina terug.", 502);
  await prisma.developerInvoice.update({ where: { id }, data: { stripeCheckoutSessionId: session.id } });
  await logEvent(id, "CHECKOUT_STARTED", { sessionId: session.id });
  return { url: session.url };
}

/** Confirms a Stripe payment for this invoice; returns true once the invoice is paid. */
export async function confirmDeveloperInvoiceCheckout(id: string, sessionId: string, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<boolean> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id } });
  if (!invoice) return false;
  if (invoice.status === "PAID") return true;
  if (invoice.status !== "SENT") return false;
  const session = await retrieveStripeCheckoutSession(await stripeKeyOrThrow(), sessionId, deps.stripeFetch);
  if (session.metadata?.developer_invoice_id !== id || session.payment_status !== "paid") return false;
  await markDeveloperInvoicePaid(id, "stripe", { now: deps.now ?? defaultDeps.now });
  return true;
}

// ---------- Reminders ----------

export type ReminderRunResult = { checked: number; paid: number; firstReminders: number; secondReminders: number; failures: number };

/**
 * Runs the automatic flow for open invoices: confirms Stripe payments that came in,
 * then sends the first reminder 7 days after sending and the second 14 days later.
 * Safe to run often and from several places: every step is claimed before it is done.
 */
export async function processDeveloperInvoiceReminders(deps: DeveloperInvoiceDeps = defaultDeps): Promise<ReminderRunResult> {
  const now = deps.now();
  const open = await prisma.developerInvoice.findMany({ where: { status: "SENT" } });
  const result: ReminderRunResult = { checked: open.length, paid: 0, firstReminders: 0, secondReminders: 0, failures: 0 };

  for (const invoice of open) {
    if (invoice.stripeCheckoutSessionId) {
      try {
        if (await confirmDeveloperInvoiceCheckout(invoice.id, invoice.stripeCheckoutSessionId, deps)) {
          result.paid += 1;
          continue;
        }
      } catch (error) {
        if (!(error instanceof DeveloperStripeError || error instanceof DeveloperInvoiceError)) throw error;
      }
    }

    const reminder = dueReminder(invoice, now);
    if (!reminder) continue;
    const first = reminder === "FIRST";
    const claimed = await prisma.developerInvoice.updateMany({
      where: first ? { id: invoice.id, status: "SENT", firstReminderAt: null } : { id: invoice.id, status: "SENT", secondReminderAt: null },
      data: first ? { firstReminderAt: now } : { secondReminderAt: now },
    });
    if (claimed.count !== 1) continue;
    try {
      await sendNotice(invoice, first ? "FIRST_REMINDER" : "SECOND_REMINDER", deps);
      if (first) result.firstReminders += 1;
      else result.secondReminders += 1;
    } catch (error) {
      // Release the claim so the next run tries again.
      await prisma.developerInvoice.update({ where: { id: invoice.id }, data: first ? { firstReminderAt: null } : { secondReminderAt: null } });
      await logEvent(invoice.id, "EMAIL_FAILED", { kind: reminder, message: error instanceof Error ? error.message : String(error) });
      result.failures += 1;
    }
  }
  return result;
}

/** Open invoices for the admin banner. */
export async function openDeveloperInvoiceSummary(): Promise<{ count: number; totalCents: number; overdue: number }> {
  const open = await prisma.developerInvoice.findMany({ where: { status: "SENT" }, select: { totalCents: true, dueDate: true } });
  const now = Date.now();
  return {
    count: open.length,
    totalCents: open.reduce((sum, invoice) => sum + invoice.totalCents, 0),
    overdue: open.filter((invoice) => invoice.dueDate.getTime() < now).length,
  };
}

export function publicDeveloperProfile(profile: DeveloperBillingProfile) {
  return {
    businessName: profile.businessName,
    contactName: profile.contactName,
    email: profile.email,
    address: profile.address,
    postalCode: profile.postalCode,
    city: profile.city,
    country: profile.country,
    kvkNumber: profile.kvkNumber,
    vatNumber: profile.vatNumber,
    payment: paymentSummary(profile),
    bic: profile.bankTransferEnabled ? profile.bic : "",
  };
}

export type PublicDeveloperProfile = ReturnType<typeof publicDeveloperProfile>;

export function mapDeveloperError(error: unknown): { status: number; body: { error: string; message: string; fields?: Record<string, string> } } {
  if (error instanceof DeveloperInvoiceError || error instanceof DeveloperStripeError) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return {
      status: 422,
      body: {
        error: "INVALID_INPUT",
        message: first?.message ?? "Controleer de invoer.",
        fields: Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message])),
      },
    };
  }
  console.error("Developer invoicing: unexpected error", error);
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "Er ging iets mis. Probeer het opnieuw." } };
}
