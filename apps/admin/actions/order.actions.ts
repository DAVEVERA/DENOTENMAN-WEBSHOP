"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import { createInvoiceEmailHtml, getInvoiceNumber } from "../lib/invoices";
import {
  getAdminOrder,
  type AdminOrderStatus,
  type AdminPaymentStatus,
  updateAdminOrderStatus,
} from "../lib/orders";

const orderStatuses = ["pending", "paid", "processing", "shipped", "cancelled"] as const;
const paymentStatuses = [
  "draft",
  "open",
  "pending",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();

  const orderId = getString(formData, "orderId");
  const status = getString(formData, "status") as AdminOrderStatus;
  const paymentStatus = getString(formData, "paymentStatus") as AdminPaymentStatus;

  if (!orderId) {
    throw new Error("Order-id ontbreekt.");
  }

  if (!orderStatuses.includes(status)) {
    throw new Error("Ongeldige orderstatus.");
  }

  await updateAdminOrderStatus({
    orderId,
    status,
    paymentStatus: paymentStatuses.includes(paymentStatus) ? paymentStatus : undefined,
  });

  revalidatePath("/dashboard");
  revalidatePath("/bestellingen");
  revalidatePath(`/bestellingen/${orderId}`);
  revalidatePath("/betalingen");

  redirect(`/bestellingen/${orderId}`);
}

export async function sendInvoiceAction(formData: FormData) {
  const session = await requireAdmin();
  const orderId = getString(formData, "orderId");

  if (!orderId) {
    throw new Error("Order-id ontbreekt.");
  }

  const order = await getAdminOrder(orderId);

  if (!order) {
    throw new Error("Bestelling niet gevonden.");
  }

  if (!order.customerEmail) {
    throw new Error("Deze bestelling heeft geen e-mailadres.");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL ?? "facturen@denotenman.nl";
  const fromName = process.env.MAIL_FROM_NAME ?? "De Notenman";

  if (!apiKey) {
    throw new Error("Factuur verzenden vereist RESEND_API_KEY in de admin environment.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [order.customerEmail],
      subject: `Factuur ${getInvoiceNumber(order)} - De Notenman`,
      html: createInvoiceEmailHtml(order),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Factuur verzenden is niet gelukt: ${message}`);
  }

  await createAuditLog({
    actorEmail: session.email,
    action: "Factuur verzonden",
    entityType: "order",
    entityId: order.id,
  });

  revalidatePath(`/bestellingen/${orderId}`);
  revalidatePath(`/bestellingen/${orderId}/factuur`);
  redirect(`/bestellingen/${orderId}/factuur?sent=1`);
}
