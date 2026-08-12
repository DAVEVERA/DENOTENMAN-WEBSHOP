import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type AdminSimpleRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  updatedAt: string | null;
};

function mapRecord(row: any, subtitleKey: string): AdminSimpleRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? row.code ?? row.subject ?? "Onbekend"),
    subtitle: row[subtitleKey] ?? null,
    status: String(row.status ?? (row.is_active === false ? "inactive" : "active")),
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
}

async function listTable(table: string, columns: string, subtitleKey: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => mapRecord(row, subtitleKey));
}

export async function listDiscounts() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("discounts")
    .select("id,code,name,discount_type,value,is_active,updated_at,created_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.code),
    subtitle: `${row.discount_type ?? "percent"} ${row.value ?? 0}`,
    status: row.is_active === false ? "Inactief" : "Actief",
    updatedAt: row.updated_at ?? row.created_at ?? null,
  }));
}

export async function listMarketingBanners() {
  return listTable(
    "marketing_banners",
    "id,title,position,status,updated_at,created_at",
    "position",
  );
}

export async function listMarketingCampaigns() {
  return listTable(
    "marketing_campaigns",
    "id,title,channel,status,updated_at,created_at",
    "channel",
  );
}

export async function listNewsletterCampaigns() {
  return listTable(
    "newsletter_campaigns",
    "id,title,subject,status,updated_at,created_at",
    "subject",
  );
}

function normalizeDate(value: string | null) {
  return value ? new Date(value).toISOString() : null;
}

export async function createMarketingBanner(input: {
  title: string;
  position: string;
  image: string | null;
  href: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("marketing_banners")
    .insert({
      title: input.title,
      position: input.position,
      image: input.image,
      href: input.href,
      status: input.status,
      starts_at: normalizeDate(input.startsAt),
      ends_at: normalizeDate(input.endsAt),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function createMarketingCampaign(input: {
  title: string;
  channel: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      title: input.title,
      channel: input.channel,
      status: input.status,
      starts_at: normalizeDate(input.startsAt),
      ends_at: normalizeDate(input.endsAt),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function createNewsletterCampaign(input: {
  title: string;
  subject: string | null;
  audience: string | null;
  status: string;
  sentAt: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .insert({
      title: input.title,
      subject: input.subject,
      audience: input.audience,
      status: input.status,
      sent_at: normalizeDate(input.sentAt),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function upsertDiscount(input: {
  code: string;
  name: string | null;
  discountType: string;
  value: number;
  isActive: boolean;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("discounts").upsert(
    {
      code: input.code,
      name: input.name,
      discount_type: input.discountType,
      value: input.value,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "code" },
  );

  if (error) throw new Error(error.message);
}
