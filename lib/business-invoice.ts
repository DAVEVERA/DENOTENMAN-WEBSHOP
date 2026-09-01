import "server-only";

import { createElement } from "react";
import { render } from "react-email";
import type { BusinessAccount, Invoice, Order, OrderItem, Prisma } from "@prisma/client";
import { EmailDeliveryKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateVat } from "@/lib/business-vat";
import { formatPrice } from "@/lib/format";
import { BASE_URL } from "@/lib/routes";
import { renderInvoicePdfBase64 } from "@/lib/business-invoice-pdf";
import { recordBusinessEvent } from "@/lib/business-portal";
import { deliverTransactionalEmail } from "@/lib/transactional-email";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { BusinessInvoiceEmail } from "@/emails/BusinessInvoiceEmail";

function merchantInvoiceRecipient(): string {
  return process.env.ORDER_NOTIFICATION_EMAIL?.trim() || LEGAL_IDENTITY.email;
}

const REVERSE_CHARGE_NOTE =
  "BTW verlegd naar de afnemer (intracommunautaire levering, art. 138 Btw-richtlijn / art. 39bis Belgisch Btw-Wetboek).";

async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await tx.invoiceCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `F${year}-${String(counter.lastNumber).padStart(6, "0")}`;
}

/**
 * Generates (or returns the existing) invoice for a paid business order.
 * The VAT rate/regime are copied from the account at this exact moment and
 * frozen on the Invoice row — a later change to the account's BTW settings
 * must never retroactively alter an already-issued invoice.
 */
export async function generateInvoiceForOrder(
  order: Order & { items: OrderItem[] },
  businessAccount: BusinessAccount
) {
  const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (existing) return existing;

  const vatRatePercent = Number(businessAccount.vatRatePercent);
  const { vatAmountCents, totalCents } = calculateVat(order.subtotalCents, vatRatePercent);
  const vatNote = businessAccount.vatRegime === "REVERSE_CHARGE" ? REVERSE_CHARGE_NOTE : null;
  const createdAt = new Date();

  return prisma.$transaction(async (tx) => {
    const alreadyCreated = await tx.invoice.findUnique({ where: { orderId: order.id } });
    if (alreadyCreated) return alreadyCreated;

    const invoiceNumber = await nextInvoiceNumber(tx);
    const pdfBase64 = await renderInvoicePdfBase64({
      invoiceNumber,
      createdAt,
      companyName: businessAccount.companyName,
      contactName: businessAccount.contactName,
      email: businessAccount.email,
      kvkNumber: businessAccount.kvkNumber,
      vatNumber: businessAccount.vatNumber,
      country: businessAccount.country,
      items: order.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel || null,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      subtotalCents: order.subtotalCents,
      vatRatePercent,
      vatAmountCents,
      totalCents,
      vatNote,
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        businessAccountId: businessAccount.id,
        subtotalCents: order.subtotalCents,
        vatRatePercent,
        vatRegime: businessAccount.vatRegime,
        vatAmountCents,
        totalCents,
        invoiceNote: vatNote,
        pdfBase64,
        peppolStatus: businessAccount.country === "BE" ? "PENDING" : "NOT_APPLICABLE",
      },
    });

    await recordBusinessEvent(tx, {
      businessAccountId: businessAccount.id,
      type: "INVOICE_GENERATED",
      actorType: "SYSTEM",
      actorName: "Systeem",
      summary: `Factuur ${invoiceNumber} aangemaakt`,
    });

    return invoice;
  });
}

function acceptedOrPending(result: Awaited<ReturnType<typeof deliverTransactionalEmail>>): boolean {
  if (result.status === "accepted" || result.status === "pending") return true;
  return result.status === "duplicate" && result.deliveryStatus !== "FAILED";
}

async function sendInvoiceEmailTo(
  invoice: Invoice,
  recipientEmail: string,
  recipientName: string,
  companyName: string,
  downloadUrl: string
): Promise<void> {
  const vatLabel = invoice.vatRegime === "REVERSE_CHARGE" ? "BTW verlegd" : `BTW (${Number(invoice.vatRatePercent)}%)`;
  const invoiceDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(invoice.createdAt);
  const html = await render(createElement(BusinessInvoiceEmail, {
    preview: `Factuur ${invoice.invoiceNumber} van De Notenman`,
    recipientName,
    companyName,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate,
    subtotal: formatPrice(invoice.subtotalCents, "nl"),
    vatLabel,
    vatAmount: formatPrice(invoice.vatAmountCents, "nl"),
    total: formatPrice(invoice.totalCents, "nl"),
    downloadUrl,
  }));
  const text = [
    `Factuur ${invoice.invoiceNumber}`,
    `Factuurdatum: ${invoiceDate}`,
    `Subtotaal (excl. BTW): ${formatPrice(invoice.subtotalCents, "nl")}`,
    `${vatLabel}: ${formatPrice(invoice.vatAmountCents, "nl")}`,
    `Totaal: ${formatPrice(invoice.totalCents, "nl")}`,
    "",
    `Download: ${downloadUrl}`,
  ].join("\n");

  const result = await deliverTransactionalEmail({
    idempotencyKey: `business-invoice:${invoice.id}:${recipientEmail.toLowerCase()}`,
    kind: EmailDeliveryKind.BUSINESS_INVOICE,
    recipientEmail,
    recipientName,
    orderId: invoice.orderId,
    trigger: "ORDER_PAID",
    subject: `Factuur ${invoice.invoiceNumber} - De Notenman`,
    html,
    text,
  });
  if (!acceptedOrPending(result)) {
    const message = result.status === "failed" ? result.error : `E-mail niet geaccepteerd (${result.status})`;
    throw new Error(message);
  }
}

/** Emails the same invoice PDF to both the business customer and Fedor. */
export async function generateAndSendBusinessInvoice(
  order: Order & { items: OrderItem[] },
  businessOrderListId: string
): Promise<void> {
  const orderList = await prisma.businessOrderList.findUniqueOrThrow({
    where: { id: businessOrderListId },
    include: { businessAccount: true },
  });
  const businessAccount = orderList.businessAccount;
  const invoice = await generateInvoiceForOrder(order, businessAccount);

  const customerDownloadUrl = `${BASE_URL}/api/business/order-lists/${businessOrderListId}/invoice`;
  const merchantDownloadUrl = `${BASE_URL}/api/admin/business-accounts/${businessAccount.id}/invoices/${invoice.id}`;

  const results = await Promise.allSettled([
    sendInvoiceEmailTo(invoice, businessAccount.email, businessAccount.contactName, businessAccount.companyName, customerDownloadUrl),
    sendInvoiceEmailTo(invoice, merchantInvoiceRecipient(), "Fedor", businessAccount.companyName, merchantDownloadUrl),
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    console.error("One or more business invoice emails failed", failures.map((failure) => failure.reason));
  }

  await prisma.$transaction(async (tx) => {
    await recordBusinessEvent(tx, {
      businessAccountId: businessAccount.id,
      type: "INVOICE_SENT",
      actorType: "SYSTEM",
      actorName: "Systeem",
      summary: `Factuur ${invoice.invoiceNumber} verstuurd naar klant en Fedor`,
    });
  });
}
