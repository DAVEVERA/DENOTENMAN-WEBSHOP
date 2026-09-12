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
import { merchantOrderNotificationRecipient } from "@/lib/merchant-order-notification";
import { BusinessInvoiceEmail } from "@/emails/BusinessInvoiceEmail";
import { getBusinessLifecycleEmailContent, substituteBusinessLifecycleTokens } from "@/lib/business-lifecycle-email-content";

const REVERSE_CHARGE_NOTE =
  "BTW verlegd naar de afnemer (intracommunautaire levering, art. 138 Btw-richtlijn / art. 39bis Belgisch Btw-Wetboek).";

/**
 * Invoice numbers are {countryCode}{counter}, e.g. NL0031 or BE0032 - each
 * country has its own running counter (not shared, not year-scoped) so an
 * admin export can filter invoices by country from the number alone.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient, countryCode: string): Promise<string> {
  const counter = await tx.invoiceCounter.upsert({
    where: { countryCode },
    create: { countryCode, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${countryCode}${String(counter.lastNumber).padStart(4, "0")}`;
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

  // Renders a PDF (headless-browser launch + render) inside the transaction,
  // so the default 5000ms interactive-transaction timeout must be raised —
  // a cold instance's browser launch alone can take longer than that,
  // otherwise Prisma closes the transaction before tx.invoice.create() runs
  // (P2028) even though the render itself succeeded.
  return prisma.$transaction(async (tx) => {
    const alreadyCreated = await tx.invoice.findUnique({ where: { orderId: order.id } });
    if (alreadyCreated) return alreadyCreated;

    const invoiceNumber = await nextInvoiceNumber(tx, businessAccount.country);
    const pdfBase64 = await renderInvoicePdfBase64({
      invoiceNumber,
      createdAt,
      companyName: businessAccount.companyName,
      contactName: businessAccount.contactName,
      email: businessAccount.email,
      kvkNumber: businessAccount.kvkNumber,
      vatNumber: businessAccount.vatNumber,
      country: businessAccount.country,
      billingStreet: businessAccount.billingStreet,
      billingHouseNumber: businessAccount.billingHouseNumber,
      billingPostalCode: businessAccount.billingPostalCode,
      billingCity: businessAccount.billingCity,
      billingCountry: businessAccount.billingCountry,
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
      paidCents: order.totalCents,
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
  }, { timeout: 20000 });
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
  const tokens = { invoiceNumber: invoice.invoiceNumber, recipientName, companyName };
  const content = await getBusinessLifecycleEmailContent("INVOICE");
  const subject = substituteBusinessLifecycleTokens(content.subject, tokens);
  const heading = substituteBusinessLifecycleTokens(content.heading, tokens);
  const bodyText = substituteBusinessLifecycleTokens(content.bodyText, tokens);
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
    heading,
    bodyText,
    buttonLabel: content.buttonLabel,
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
    subject,
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

  const customerDownloadUrl = `${BASE_URL}/api/business/orders/${order.id}/invoice`;
  const merchantDownloadUrl = `${BASE_URL}/api/admin/business-accounts/${businessAccount.id}/invoices/${invoice.id}`;

  const results = await Promise.allSettled([
    sendInvoiceEmailTo(invoice, businessAccount.email, businessAccount.contactName, businessAccount.companyName, customerDownloadUrl),
    sendInvoiceEmailTo(invoice, merchantOrderNotificationRecipient(), "Fedor", businessAccount.companyName, merchantDownloadUrl),
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
