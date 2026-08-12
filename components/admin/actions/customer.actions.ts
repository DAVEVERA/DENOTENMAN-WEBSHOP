"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import { createBusinessCustomer } from "../lib/business";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveBusinessCustomerAction(formData: FormData) {
  const session = await requireAdmin();
  const company = getString(formData, "company");
  const email = getString(formData, "email");
  const status = getString(formData, "status") || "active";

  if (!company || !email) throw new Error("Bedrijfsnaam en e-mail zijn verplicht.");

  const id = await createBusinessCustomer({
    company,
    contactName: getString(formData, "contact") || null,
    email,
    phone: getString(formData, "phone") || null,
    invoiceAddress: getString(formData, "invoiceAddress") || null,
    shippingAddress: getString(formData, "shippingAddress") || null,
    kvkNumber: getString(formData, "kvkNumber") || null,
    vatNumber: getString(formData, "vatNumber") || null,
    paymentOnAccount: formData.get("paymentOnAccount") === "on",
    notes: getString(formData, "notes") || null,
    status,
  });

  await createAuditLog({
    actorEmail: session.email,
    action: "Zakelijke klant aangemaakt",
    entityType: "business_customer",
    entityId: id,
  });
  revalidatePath("/zakelijk/klanten");
  redirect(`/zakelijk/klanten/${id}`);
}
