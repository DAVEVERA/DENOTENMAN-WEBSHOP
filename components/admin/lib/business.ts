import "server-only";
import { listAdminOrders } from "./orders";
import { createAdminSupabaseClient } from "./supabase/server";

export type BusinessModuleStatus = {
  configured: boolean;
  reason: string;
};

export async function getBusinessModuleStatus(): Promise<BusinessModuleStatus> {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("business_customers")
    .select("id", { count: "exact", head: true });

  if (!error) {
    return {
      configured: true,
      reason: `${count ?? 0} zakelijke klanten gekoppeld aan Supabase.`,
    };
  }

  return {
    configured: false,
    reason:
      "B2B-tabellen zijn nog niet beschikbaar in Supabase. Pas de business migrations toe voordat deze module live kan.",
  };
}

export async function listBusinessCustomers() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("business_customers")
    .select("id,company,contact_name,email,phone,invoice_address,billing_address,status,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    company: String(row.company),
    contactName: row.contact_name ?? null,
    email: String(row.email),
    phone: row.phone ?? null,
    invoiceAddress: row.billing_address ?? row.invoice_address ?? null,
    status: String(row.status ?? "active"),
    createdAt: row.created_at ?? null,
  }));
}

export async function getBusinessCustomer(id: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("business_customers")
    .select(
      "id,company,contact_name,email,phone,invoice_address,billing_address,shipping_address,kvk_number,vat_number,payment_on_account,notes,status,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: String(data.id),
    company: String(data.company),
    contactName: data.contact_name ?? null,
    email: String(data.email),
    phone: data.phone ?? null,
    invoiceAddress: data.billing_address ?? data.invoice_address ?? null,
    shippingAddress: data.shipping_address ?? null,
    kvkNumber: data.kvk_number ?? null,
    vatNumber: data.vat_number ?? null,
    paymentOnAccount: Boolean(data.payment_on_account),
    notes: data.notes ?? null,
    status: String(data.status ?? "active"),
    createdAt: data.created_at ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

export async function createBusinessCustomer(input: {
  company: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  invoiceAddress: string | null;
  shippingAddress: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  paymentOnAccount: boolean;
  notes: string | null;
  status: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("business_customers")
    .insert({
      company: input.company,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      invoice_address: input.invoiceAddress,
      billing_address: input.invoiceAddress,
      shipping_address: input.shippingAddress,
      kvk_number: input.kvkNumber,
      vat_number: input.vatNumber,
      payment_on_account: input.paymentOnAccount,
      notes: input.notes,
      status: input.status,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function listBusinessInvoiceCandidates() {
  const orders = await listAdminOrders(200);
  return orders.filter((order) => order.customerEmail);
}
