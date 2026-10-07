import "server-only";
import { createHash } from "node:crypto";
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
  createStripeWebhookEndpoint,
  deleteStripeWebhookEndpoint,
  DEVELOPER_STRIPE_WEBHOOK_EVENTS,
  DeveloperStripeError,
  listStripeWebhookEndpoints,
  looksLikeStripeSecretKey,
  retrieveStripeCheckoutSession,
  sessionInvoiceIds,
  verifyStripeKey,
  verifyStripeSignature,
} from "./stripe";
import { extractInvoiceFromFile, InvoiceExtractionError, type GenerateFn } from "./extract";
import { eurRateFor, ExchangeRateError, toEuroCents, type EurRate, type ForeignCurrency } from "./fx";
import { describeDevice, networkOf, type DeviceScreen } from "./device";

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
  /** Reading uploaded invoices; injected in tests. */
  generate?: GenerateFn;
  /** ECB exchange rates; injected in tests. */
  rateFor?: (currency: ForeignCurrency, date: string) => Promise<EurRate>;
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

export type DeveloperProfileDto = Omit<DeveloperBillingProfile, "stripeSecretKeyEncrypted" | "stripeWebhookEndpointId" | "stripeWebhookSecretEncrypted" | "updatedAt"> & {
  stripeKeyConfigured: boolean;
  /** Stripe reports payments to the shop, so paid invoices are marked paid automatically. */
  stripeWebhookActive: boolean;
  /** Why the webhook could not be set up on the last save, in Dutch. */
  stripeWebhookNotice: string | null;
  /** False when a stored key can no longer be decrypted and must be entered again. */
  stripeKeyReadable: boolean;
  stripeKeyHint: string | null;
  stripeKeyMode: "live" | "test" | null;
  updatedAt: string;
};

export async function getDeveloperProfile(): Promise<DeveloperBillingProfile> {
  return prisma.developerBillingProfile.upsert({ where: { id: PROFILE_ID }, update: {}, create: { id: PROFILE_ID } });
}

export function developerProfileDto(profile: DeveloperBillingProfile, stripeWebhookNotice: string | null = null): DeveloperProfileDto {
  const { stripeSecretKeyEncrypted, stripeWebhookEndpointId, stripeWebhookSecretEncrypted, updatedAt, ...rest } = profile;
  const key = openSecret(stripeSecretKeyEncrypted);
  return {
    ...rest,
    stripeKeyConfigured: Boolean(stripeSecretKeyEncrypted),
    stripeWebhookActive: Boolean(key && stripeWebhookEndpointId && openSecret(stripeWebhookSecretEncrypted)),
    stripeWebhookNotice,
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
  const keyChanged = stripeSecretKeyEncrypted !== current.stripeSecretKeyEncrypted;
  if (keyChanged && current.stripeWebhookEndpointId) {
    // The old webhook belongs to the old key (maybe another account): remove it where possible.
    const oldKey = openSecret(current.stripeSecretKeyEncrypted);
    if (oldKey) await deleteStripeWebhookEndpoint(oldKey, current.stripeWebhookEndpointId, deps.stripeFetch).catch(() => undefined);
  }
  const saved = await prisma.developerBillingProfile.update({
    where: { id: PROFILE_ID },
    data: { ...fields, stripeSecretKeyEncrypted, ...(keyChanged ? { stripeWebhookEndpointId: null, stripeWebhookSecretEncrypted: null } : {}) },
  });
  if (!saved.stripeEnabled || !stripeSecretKeyEncrypted) return developerProfileDto(saved);
  const webhook = await ensureDeveloperStripeWebhook(deps);
  return developerProfileDto(await getDeveloperProfile(), webhook.active ? null : webhook.message);
}

export function developerStripeWebhookUrl(): string {
  return `${BASE_URL}/api/webhooks/developer-stripe`;
}

/**
 * Makes sure Stripe reports payments to the shop. The webhook is created with the stored
 * key; an earlier one for the same address (whose secret is gone) is replaced. Never
 * throws: without a webhook, payments are still confirmed on return and on page loads.
 */
export async function ensureDeveloperStripeWebhook(deps: Partial<DeveloperInvoiceDeps> = {}): Promise<{ active: boolean; message: string | null }> {
  const profile = await getDeveloperProfile();
  const key = openSecret(profile.stripeSecretKeyEncrypted);
  if (!profile.stripeEnabled || !key) return { active: false, message: null };
  if (profile.stripeWebhookEndpointId && openSecret(profile.stripeWebhookSecretEncrypted)) return { active: true, message: null };
  const url = developerStripeWebhookUrl();
  if (!url.startsWith("https://")) return { active: false, message: "Automatisch op betaald zetten werkt alleen op de live site." };
  try {
    for (const endpoint of await listStripeWebhookEndpoints(key, deps.stripeFetch)) {
      if (endpoint.url === url) await deleteStripeWebhookEndpoint(key, endpoint.id, deps.stripeFetch);
    }
    const created = await createStripeWebhookEndpoint(key, url, deps.stripeFetch);
    await prisma.developerBillingProfile.update({
      where: { id: PROFILE_ID },
      data: { stripeWebhookEndpointId: created.id, stripeWebhookSecretEncrypted: sealSecret(created.secret) },
    });
    return { active: true, message: null };
  } catch (error) {
    console.warn("Developer invoices: Stripe webhook setup failed", { code: error instanceof DeveloperStripeError ? error.code : "UNKNOWN" });
    return {
      active: false,
      message: "Stripe liet de webhook niet aanmaken. Geef de sleutel ook schrijfrechten op Webhook Endpoints en sla opnieuw op. Tot die tijd worden betalingen gecontroleerd zodra iemand de factuurpagina opent.",
    };
  }
}

/** Handles one Stripe webhook call. Only the session id is used; its status is fetched from Stripe. */
export async function handleDeveloperStripeWebhook(payload: string, signature: string | null, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<{ ok: boolean; paid: string[] }> {
  const profile = await getDeveloperProfile();
  const secret = openSecret(profile.stripeWebhookSecretEncrypted);
  if (!secret || !verifyStripeSignature(payload, signature, secret, (deps.now ?? defaultDeps.now)().getTime())) return { ok: false, paid: [] };
  let event: { type?: unknown; data?: { object?: { id?: unknown } } };
  try {
    event = JSON.parse(payload);
  } catch {
    return { ok: false, paid: [] };
  }
  const sessionId = event.data?.object?.id;
  if (!(DEVELOPER_STRIPE_WEBHOOK_EVENTS as readonly unknown[]).includes(event.type) || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return { ok: true, paid: [] };
  }
  return { ok: true, paid: await confirmDeveloperInvoiceSession(sessionId, deps) };
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
  /** False when the invoice was set ready without an e-mail to the client. */
  notifyClient: boolean;
  firstReminderAt: string | null;
  secondReminderAt: string | null;
  paidAt: string | null;
  paidVia: string | null;
  events: Array<{ type: string; createdAt: string; detail: unknown }>;
  /** How often De Notenman opened this invoice or its file; only for the developer, null elsewhere. */
  views: { count: number; lastAt: string | null; lastBy: string | null } | null;
  /** The uploaded original, if the invoice came from a file. */
  attachment: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    printedTotalCents: number | null;
    warnings: string[];
    /** Set when the uploaded invoice was in dollars and has been converted to euros. */
    conversion: { currency: string; rate: number; rateDate: string; originalTotalCents: number } | null;
  } | null;
};

function storedLines(value: Prisma.JsonValue): DeveloperInvoiceLine[] {
  const parsed = z.array(developerInvoiceLineSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

type AttachmentSummary = { filename: string; contentType: string; sizeBytes: number; extracted: Prisma.JsonValue };

function attachmentDto(attachment: AttachmentSummary | null | undefined): DeveloperInvoiceDto["attachment"] {
  if (!attachment) return null;
  const extracted = (attachment.extracted ?? {}) as {
    printed?: { totalCents?: number };
    warnings?: unknown;
    conversion?: { currency?: unknown; rate?: unknown; rateDate?: unknown; originalTotalCents?: unknown };
  };
  const conversion = extracted.conversion;
  return {
    filename: attachment.filename,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    printedTotalCents: typeof extracted.printed?.totalCents === "number" ? extracted.printed.totalCents : null,
    warnings: Array.isArray(extracted.warnings) ? extracted.warnings.filter((item): item is string => typeof item === "string") : [],
    conversion: conversion && typeof conversion.rate === "number" && typeof conversion.rateDate === "string" && typeof conversion.originalTotalCents === "number"
      ? { currency: String(conversion.currency ?? "USD"), rate: conversion.rate, rateDate: conversion.rateDate, originalTotalCents: conversion.originalTotalCents }
      : null,
  };
}

export function developerInvoiceDto(
  invoice: DeveloperInvoice & {
    events?: Array<{ type: string; createdAt: Date; detail: Prisma.JsonValue }>;
    attachment?: AttachmentSummary | null;
    views?: Array<{ createdAt: Date; viewerName: string }>;
    _count?: { views: number };
  },
  now = new Date(),
  options: { includeViews?: boolean } = {},
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
    notifyClient: invoice.notifyClient,
    firstReminderAt: invoice.firstReminderAt?.toISOString() ?? null,
    secondReminderAt: invoice.secondReminderAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    paidVia: invoice.paidVia,
    events: (invoice.events ?? []).map((event) => ({ type: event.type, createdAt: event.createdAt.toISOString(), detail: event.detail })),
    views: options.includeViews
      ? {
        count: invoice._count?.views ?? 0,
        lastAt: invoice.views?.[0]?.createdAt.toISOString() ?? null,
        lastBy: invoice.views?.[0]?.viewerName ?? null,
      }
      : null,
    attachment: attachmentDto(invoice.attachment),
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

const withEvents = {
  events: { orderBy: { createdAt: "asc" as const } },
  // Never load the file itself into a list; it is served by its own route.
  attachment: { select: { filename: true, contentType: true, sizeBytes: true, extracted: true } },
  views: { orderBy: { createdAt: "desc" as const }, take: 1, select: { createdAt: true, viewerName: true } },
  _count: { select: { views: true } },
};

export async function listDeveloperInvoices(options: { publishedOnly?: boolean } = {}): Promise<DeveloperInvoiceDto[]> {
  const invoices = await prisma.developerInvoice.findMany({
    where: options.publishedOnly ? { status: { in: ["SENT", "PAID"] } } : undefined,
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: withEvents,
  });
  // Who looked at the invoices is for the developer only, never for De Notenman's pages.
  return invoices.map((invoice) => developerInvoiceDto(invoice, new Date(), { includeViews: !options.publishedOnly }));
}

export async function getDeveloperInvoice(id: string, options: { publishedOnly?: boolean } = {}): Promise<DeveloperInvoiceDto> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id }, include: withEvents });
  if (!invoice || (options.publishedOnly && !["SENT", "PAID"].includes(invoice.status))) {
    throw new DeveloperInvoiceError("INVOICE_NOT_FOUND", "Deze factuur bestaat niet.", 404);
  }
  return developerInvoiceDto(invoice, new Date(), { includeViews: !options.publishedOnly });
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

function formatForeign(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

function dutchDate(date: string): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function todayInAmsterdam(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(now);
}

/**
 * Turns an uploaded invoice file into a draft: the AI reads number, dates and amounts,
 * the original is kept with it, and the developer checks it before setting it ready.
 */
export async function createDeveloperInvoiceFromUpload(
  file: { filename: string; contentType: string; bytes: Buffer },
  deps: Partial<DeveloperInvoiceDeps> = {},
): Promise<{ invoice: DeveloperInvoiceDto; warnings: string[] }> {
  const now = (deps.now ?? defaultDeps.now)();
  const extracted = await extractInvoiceFromFile({ bytes: file.bytes, contentType: file.contentType }, deps.generate);
  const profile = await getDeveloperProfile();
  const issueDate = extracted.issueDate ?? todayInAmsterdam(now);
  const issue = invoiceDateFromInput(issueDate);
  const dueFromFile = extracted.dueDate ? invoiceDateFromInput(extracted.dueDate) : null;
  const termDays = dueFromFile && dueFromFile >= issue ? Math.round((dueFromFile.getTime() - issue.getTime()) / 86_400_000) : profile.paymentTermDays;

  // Dollar invoices are converted with the ECB rate of the invoice date; the original
  // amounts stay visible on the invoice and in the record.
  let lines = extracted.lines;
  let printed = extracted.printed;
  let notes: string | null = null;
  let conversion: { currency: string; rate: number; rateDate: string; originalTotalCents: number; originalPrinted: typeof extracted.printed } | null = null;
  if (extracted.currency === "USD") {
    const rate = await (deps.rateFor ?? eurRateFor)("USD", issueDate);
    lines = extracted.lines.map((line) => ({
      ...line,
      description: `${line.description} ($ ${formatForeign(line.unitPriceCents * line.quantity)})`.slice(0, 300),
      unitPriceCents: toEuroCents(line.unitPriceCents, rate.rate),
    }));
    printed = {
      subtotalCents: toEuroCents(extracted.printed.subtotalCents, rate.rate),
      vatCents: toEuroCents(extracted.printed.vatCents, rate.rate),
      totalCents: toEuroCents(extracted.printed.totalCents, rate.rate),
    };
    conversion = { currency: "USD", rate: rate.rate, rateDate: rate.rateDate, originalTotalCents: extracted.printed.totalCents, originalPrinted: extracted.printed };
    notes = `Omgerekend van $ ${formatForeign(extracted.printed.totalCents)} tegen de ECB-koers van ${dutchDate(rate.rateDate)}: 1 euro = ${String(rate.rate).replace(".", ",")} dollar.`;
  }

  const input = developerInvoiceInputSchema.parse({
    title: extracted.title,
    issueDate,
    paymentTermDays: Math.min(termDays, 120),
    lines,
    notes,
  });
  const data = invoiceData(input);

  // Keep the number printed on the invoice when it is free; otherwise give it our own.
  const printedNumber = extracted.invoiceNumber?.replace(/\s+/gu, " ").slice(0, 60) ?? null;
  const warnings = [...extracted.warnings];
  let number = printedNumber;
  if (number && await prisma.developerInvoice.findUnique({ where: { number }, select: { id: true } })) {
    warnings.push(`Factuurnummer ${number} bestaat al; deze factuur heeft een eigen nummer gekregen. Controleer of hij niet dubbel is geüpload.`);
    number = null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invoice = await prisma.developerInvoice.create({
        data: {
          ...data,
          number: number ?? await nextInvoiceNumber(data.issueDate.getUTCFullYear()),
          attachment: {
            create: {
              filename: file.filename.slice(0, 200),
              contentType: file.contentType,
              sizeBytes: file.bytes.length,
              data: new Uint8Array(file.bytes),
              extracted: { invoiceNumber: extracted.invoiceNumber, printed, warnings, conversion } as Prisma.InputJsonValue,
            },
          },
        },
      });
      await logEvent(invoice.id, "UPLOADED", { filename: file.filename.slice(0, 200), warnings } as Prisma.InputJsonValue);
      return { invoice: await getDeveloperInvoice(invoice.id), warnings };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || attempt === 2) throw error;
      number = null;
    }
  }
  throw new DeveloperInvoiceError("NUMBER_CONFLICT", "Er kon geen factuurnummer worden toegekend.", 409);
}

/** The original file of an invoice; De Notenman only sees files of invoices set ready. */
export async function getDeveloperInvoiceAttachment(id: string, options: { publishedOnly?: boolean } = {}) {
  const attachment = await prisma.developerInvoiceAttachment.findUnique({ where: { invoiceId: id }, include: { invoice: { select: { status: true } } } });
  if (!attachment || (options.publishedOnly && !["SENT", "PAID"].includes(attachment.invoice.status))) {
    throw new DeveloperInvoiceError("ATTACHMENT_NOT_FOUND", "Dit bestand bestaat niet.", 404);
  }
  return { filename: attachment.filename, contentType: attachment.contentType, data: Buffer.from(attachment.data) };
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

export function developerInvoicesOverviewUrl(): string {
  return `${BASE_URL}/admin/ontwikkelaarsfacturen`;
}

async function sendNotice(invoices: DeveloperInvoice[], kind: DeveloperInvoiceNoticeKind, deps: DeveloperInvoiceDeps, deliverySuffix = "") {
  const profile = await getDeveloperProfile();
  const to = profile.notificationEmail || merchantOrderNotificationRecipient();
  const notice = buildDeveloperInvoiceNotice({
    kind,
    invoices: invoices.map((invoice) => ({ number: invoice.number, title: invoice.title, subtotalCents: invoice.subtotalCents, vatCents: invoice.vatCents, totalCents: invoice.totalCents, issueDate: invoice.issueDate, dueDate: invoice.dueDate })),
    developerName: profile.businessName || profile.contactName,
    invoiceUrl: invoices.length === 1 ? developerInvoiceUrl(invoices[0].id) : developerInvoicesOverviewUrl(),
    payment: paymentSummary(profile),
  });
  const ids = invoices.map((invoice) => invoice.id).sort().join(",");
  const result = await deps.sendMail({
    deliveryId: `developer-invoice-${kind}-${createHash("sha256").update(ids).digest("hex").slice(0, 24)}${deliverySuffix}`,
    orderId: "",
    trigger: "DEVELOPER_INVOICE",
    to,
    subject: notice.subject,
    html: notice.html,
    text: notice.text,
  });
  for (const invoice of invoices) await logEvent(invoice.id, `EMAIL_${kind}`, { to, messageId: result.messageId, together: invoices.length });
}

/**
 * Sets one or more drafts ready. De Notenman gets one e-mail listing them with the combined
 * subtotal, VAT and total, and sees them in the admin.
 */
export async function sendDeveloperInvoices(
  ids: string[],
  deps: DeveloperInvoiceDeps = defaultDeps,
  options: { notify?: boolean } = {},
): Promise<DeveloperInvoiceDto[]> {
  // notify false: the invoices are set ready, but no notice and no later reminders go out by e-mail.
  const notify = options.notify !== false;
  const unique = [...new Set(ids)];
  if (!unique.length) throw new DeveloperInvoiceError("NOTHING_SELECTED", "Kies ten minste één concept.", 422);
  if (unique.length > 15) throw new DeveloperInvoiceError("TOO_MANY", "Zet maximaal 15 facturen tegelijk klaar.", 422);
  const profile = await getDeveloperProfile();
  const methods = paymentSummary(profile);
  if (!methods.stripe && !methods.bankTransfer && !methods.link) {
    throw new DeveloperInvoiceError("NO_PAYMENT_METHOD", "Stel eerst minimaal één betaalmogelijkheid in.", 422);
  }
  const drafts = await prisma.developerInvoice.count({ where: { id: { in: unique }, status: "DRAFT" } });
  if (drafts !== unique.length) throw new DeveloperInvoiceError("INVOICE_NOT_SENDABLE", "Een of meer facturen zijn al verstuurd of geannuleerd.", 409);
  const now = deps.now();
  const claimed: string[] = [];
  for (const id of unique) {
    const result = await prisma.developerInvoice.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENT", sentAt: now, notifyClient: notify } });
    if (result.count === 1) {
      claimed.push(id);
      const detail = { ...(unique.length > 1 ? { together: unique.length } : {}), ...(notify ? {} : { notify: false }) };
      await logEvent(id, "SENT", Object.keys(detail).length ? detail : undefined);
    }
  }
  if (!claimed.length) throw new DeveloperInvoiceError("INVOICE_NOT_SENDABLE", "Deze facturen zijn al verstuurd of geannuleerd.", 409);
  const invoices = await prisma.developerInvoice.findMany({ where: { id: { in: claimed } }, orderBy: { number: "asc" } });
  if (notify) {
    try {
      await sendNotice(invoices, "READY", deps);
    } catch (error) {
      // The invoices are visible in the admin either way; the failure is logged so the developer can resend.
      for (const id of claimed) await logEvent(id, "EMAIL_FAILED", { kind: "READY", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return Promise.all(claimed.map((id) => getDeveloperInvoice(id)));
}

/** Sets one draft ready: De Notenman gets an e-mail and sees the invoice in the admin. */
export async function sendDeveloperInvoice(id: string, deps: DeveloperInvoiceDeps = defaultDeps, options: { notify?: boolean } = {}): Promise<DeveloperInvoiceDto> {
  return (await sendDeveloperInvoices([id], deps, options))[0];
}

export async function resendDeveloperInvoiceNotice(id: string, deps: DeveloperInvoiceDeps = defaultDeps): Promise<DeveloperInvoiceDto> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id } });
  if (!invoice || invoice.status !== "SENT") throw new DeveloperInvoiceError("INVOICE_NOT_OPEN", "Alleen een openstaande factuur kan opnieuw worden gemeld.", 409);
  await sendNotice([invoice], "READY", deps, `-${deps.now().getTime()}`);
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

/**
 * Starts one Stripe payment for one or more open invoices. Fedor returns to the page he
 * came from, where the payment is confirmed.
 */
export async function startDeveloperInvoicesCheckout(ids: string[], returnPath: "overview" | "detail", deps: Partial<DeveloperInvoiceDeps> = {}): Promise<{ url: string }> {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new DeveloperInvoiceError("NOTHING_SELECTED", "Kies ten minste één factuur.", 422);
  if (unique.length > 15) throw new DeveloperInvoiceError("TOO_MANY", "Betaal maximaal 15 facturen tegelijk.", 422);
  const invoices = await prisma.developerInvoice.findMany({ where: { id: { in: unique } }, orderBy: { number: "asc" } });
  if (invoices.length !== unique.length || invoices.some((invoice) => invoice.status !== "SENT")) {
    throw new DeveloperInvoiceError("INVOICE_NOT_OPEN", "Een of meer facturen staan niet meer open. Ververs de pagina.", 409);
  }
  const secretKey = await stripeKeyOrThrow();
  await ensureDeveloperStripeWebhook(deps);
  const back = returnPath === "detail" && invoices.length === 1 ? developerInvoiceUrl(invoices[0].id) : developerInvoicesOverviewUrl();
  const session = await createStripeCheckoutSession({
    secretKey,
    invoices: invoices.map((invoice) => ({ id: invoice.id, number: invoice.number, title: invoice.title, totalCents: invoice.totalCents })),
    currency: invoices[0].currency,
    successUrl: `${back}?betaling=gelukt&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${back}?betaling=geannuleerd`,
  }, deps.stripeFetch);
  if (!session.url) throw new DeveloperInvoiceError("STRIPE_NO_URL", "Stripe gaf geen betaalpagina terug.", 502);
  for (const invoice of invoices) {
    await prisma.developerInvoice.update({ where: { id: invoice.id }, data: { stripeCheckoutSessionId: session.id } });
    await logEvent(invoice.id, "CHECKOUT_STARTED", { sessionId: session.id, together: invoices.length });
  }
  return { url: session.url };
}

export async function startDeveloperInvoiceCheckout(id: string, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<{ url: string }> {
  return startDeveloperInvoicesCheckout([id], "detail", deps);
}

/** Confirms a Stripe payment; marks every invoice it covers as paid. Returns the paid ids. */
export async function confirmDeveloperInvoiceSession(sessionId: string, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<string[]> {
  const session = await retrieveStripeCheckoutSession(await stripeKeyOrThrow(), sessionId, deps.stripeFetch);
  if (session.payment_status !== "paid") return [];
  const ids = sessionInvoiceIds(session);
  // Only invoices that were actually sent to checkout with this session count as paid.
  const invoices = await prisma.developerInvoice.findMany({ where: { id: { in: ids }, stripeCheckoutSessionId: session.id } });
  const paid: string[] = [];
  for (const invoice of invoices) {
    if (invoice.status === "SENT") await markDeveloperInvoicePaid(invoice.id, "stripe", { now: deps.now ?? defaultDeps.now });
    if (invoice.status === "SENT" || invoice.status === "PAID") paid.push(invoice.id);
  }
  return paid;
}

/**
 * Asks Stripe about every open invoice with a started payment and marks the paid ones.
 * A safety net next to the webhook: runs on page loads and in the daily reminder run.
 */
export async function confirmOpenDeveloperInvoicePayments(deps: Partial<DeveloperInvoiceDeps> = {}): Promise<Set<string>> {
  const open = await prisma.developerInvoice.findMany({
    where: { status: "SENT", stripeCheckoutSessionId: { not: null } },
    select: { stripeCheckoutSessionId: true },
  });
  const paid = new Set<string>();
  for (const sessionId of new Set(open.map((invoice) => invoice.stripeCheckoutSessionId!))) {
    try {
      for (const id of await confirmDeveloperInvoiceSession(sessionId, deps)) paid.add(id);
    } catch (error) {
      if (!(error instanceof DeveloperStripeError || error instanceof DeveloperInvoiceError)) throw error;
    }
  }
  return paid;
}

/** Confirms a Stripe payment for this invoice; returns true once the invoice is paid. */
export async function confirmDeveloperInvoiceCheckout(id: string, sessionId: string, deps: Partial<DeveloperInvoiceDeps> = {}): Promise<boolean> {
  const invoice = await prisma.developerInvoice.findUnique({ where: { id } });
  if (!invoice) return false;
  if (invoice.status === "PAID") return true;
  if (invoice.status !== "SENT") return false;
  return (await confirmDeveloperInvoiceSession(sessionId, deps)).includes(id);
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
  const open = await prisma.developerInvoice.findMany({ where: { status: "SENT" }, orderBy: { number: "asc" } });
  const result: ReminderRunResult = { checked: open.length, paid: 0, firstReminders: 0, secondReminders: 0, failures: 0 };

  // Payments first: one Stripe session can cover several invoices.
  const paidIds = await confirmOpenDeveloperInvoicePayments(deps);
  result.paid = paidIds.size;

  // Due reminders are claimed one by one, then sent together: one e-mail per kind per run.
  const claimed: Record<"FIRST" | "SECOND", DeveloperInvoice[]> = { FIRST: [], SECOND: [] };
  for (const invoice of open) {
    if (paidIds.has(invoice.id)) continue;
    // Set ready without telling the client: no reminders either.
    if (!invoice.notifyClient) continue;
    const reminder = dueReminder(invoice, now);
    if (!reminder) continue;
    const first = reminder === "FIRST";
    const claim = await prisma.developerInvoice.updateMany({
      where: first ? { id: invoice.id, status: "SENT", firstReminderAt: null } : { id: invoice.id, status: "SENT", secondReminderAt: null },
      data: first ? { firstReminderAt: now } : { secondReminderAt: now },
    });
    if (claim.count === 1) claimed[reminder].push(invoice);
  }

  for (const kind of ["FIRST", "SECOND"] as const) {
    const invoices = claimed[kind];
    if (!invoices.length) continue;
    try {
      await sendNotice(invoices, kind === "FIRST" ? "FIRST_REMINDER" : "SECOND_REMINDER", deps);
      if (kind === "FIRST") result.firstReminders += invoices.length;
      else result.secondReminders += invoices.length;
    } catch (error) {
      // Release the claims so the next run tries again.
      for (const invoice of invoices) {
        await prisma.developerInvoice.update({ where: { id: invoice.id }, data: kind === "FIRST" ? { firstReminderAt: null } : { secondReminderAt: null } });
        await logEvent(invoice.id, "EMAIL_FAILED", { kind, message: error instanceof Error ? error.message : String(error) });
      }
      result.failures += invoices.length;
    }
  }
  return result;
}

/** Open invoices for the admin banner. */
export async function openDeveloperInvoiceSummary(): Promise<{ count: number; subtotalCents: number; vatCents: number; totalCents: number; overdue: number }> {
  const open = await prisma.developerInvoice.findMany({ where: { status: "SENT" }, select: { subtotalCents: true, vatCents: true, totalCents: true, dueDate: true } });
  const now = Date.now();
  return {
    count: open.length,
    subtotalCents: open.reduce((sum, invoice) => sum + invoice.subtotalCents, 0),
    vatCents: open.reduce((sum, invoice) => sum + invoice.vatCents, 0),
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
  if (error instanceof DeveloperInvoiceError || error instanceof DeveloperStripeError || error instanceof InvoiceExtractionError || error instanceof ExchangeRateError) {
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

// ---------- Views: when De Notenman looks at the invoices ----------

export type DeveloperInvoiceViewKind = "OVERVIEW" | "INVOICE" | "ATTACHMENT";

// Reloads and clicking back and forth within this time count as one visit.
const VIEW_REPEAT_MS = 15 * 60 * 1000;

export type DeveloperInvoiceViewDto = {
  id: string;
  kind: DeveloperInvoiceViewKind;
  invoiceId: string | null;
  invoiceNumber: string | null;
  viewerName: string;
  device: string | null;
  deviceModel: string | null;
  os: string | null;
  browser: string | null;
  screen: string | null;
  network: string | null;
  createdAt: string;
};

/** What the browser tells about itself; recorded with a view and only shown to the developer. */
export type DeveloperViewClient = {
  userAgent?: string | null;
  forwardedFor?: string | null;
  screen?: DeviceScreen | null;
  hints?: { model?: string | null; platformVersion?: string | null } | null;
};

/** Records that an admin opened the overview, an invoice or its file. Returns false when it repeats a recent visit. */
export async function recordDeveloperInvoiceView(
  input: { kind: DeveloperInvoiceViewKind; adminUserId: string; invoiceId?: string | null; client?: DeveloperViewClient },
  deps: Partial<DeveloperInvoiceDeps> = {},
): Promise<boolean> {
  const now = (deps.now ?? defaultDeps.now)();
  const invoiceId = input.invoiceId ?? null;
  const userAgent = input.client?.userAgent?.slice(0, 500) || null;
  const screen = input.client?.screen ?? null;
  const device = describeDevice(userAgent ?? "", screen, input.client?.hints ?? undefined);
  const network = networkOf(input.client?.forwardedFor);
  // Several people may share one admin login: a visit repeats only on the same device.
  const recent = await prisma.developerInvoiceView.findFirst({
    where: { kind: input.kind, invoiceId, adminUserId: input.adminUserId, userAgent, network, createdAt: { gte: new Date(now.getTime() - VIEW_REPEAT_MS) } },
    select: { id: true },
  });
  if (recent) return false;
  const admin = await prisma.adminUser.findUnique({ where: { id: input.adminUserId }, select: { name: true, username: true } });
  await prisma.developerInvoiceView.create({
    data: {
      kind: input.kind,
      invoiceId,
      adminUserId: input.adminUserId,
      viewerName: admin?.name?.trim() || admin?.username || "Onbekende beheerder",
      device: device.device,
      deviceModel: device.model,
      os: device.os,
      browser: device.browser,
      screen: screen ? `${Math.min(screen.width, screen.height)}×${Math.max(screen.width, screen.height)} @${Math.round(screen.pixelRatio)}x` : null,
      network,
      userAgent,
      createdAt: now,
    },
  });
  return true;
}

export async function listDeveloperInvoiceViews(limit = 100): Promise<DeveloperInvoiceViewDto[]> {
  const views = await prisma.developerInvoiceView.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
    include: { invoice: { select: { number: true } } },
  });
  return views.map((view) => ({
    id: view.id,
    kind: (["OVERVIEW", "INVOICE", "ATTACHMENT"].includes(view.kind) ? view.kind : "OVERVIEW") as DeveloperInvoiceViewKind,
    invoiceId: view.invoiceId,
    invoiceNumber: view.invoice?.number ?? null,
    viewerName: view.viewerName,
    device: view.device,
    deviceModel: view.deviceModel,
    os: view.os,
    browser: view.browser,
    screen: view.screen,
    network: view.network,
    createdAt: view.createdAt.toISOString(),
  }));
}

export type DeveloperDeviceDto = {
  key: string;
  device: string;
  deviceModel: string | null;
  os: string | null;
  browser: string | null;
  screen: string | null;
  networks: string[];
  visits: number;
  firstAt: string;
  lastAt: string;
};

/** The devices De Notenman used, newest first: one entry per device, model, system and browser. */
export async function listDeveloperDevices(): Promise<DeveloperDeviceDto[]> {
  const views = await prisma.developerInvoiceView.findMany({ orderBy: { createdAt: "desc" }, take: 2000 });
  const devices = new Map<string, DeveloperDeviceDto>();
  for (const view of views) {
    const device = view.device ?? "Onbekend apparaat (van voor het apparatenlogboek)";
    const key = [device, view.deviceModel, view.os, view.browser, view.screen].join("|");
    const entry = devices.get(key) ?? {
      key, device, deviceModel: view.deviceModel, os: view.os, browser: view.browser, screen: view.screen,
      networks: [], visits: 0, firstAt: view.createdAt.toISOString(), lastAt: view.createdAt.toISOString(),
    };
    entry.visits += 1;
    entry.firstAt = view.createdAt.toISOString();
    if (view.network && !entry.networks.includes(view.network)) entry.networks.push(view.network);
    devices.set(key, entry);
  }
  return [...devices.values()];
}
