import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type QrCodeTargetType =
  | "product"
  | "category"
  | "discount"
  | "whatsapp"
  | "email"
  | "wifi"
  | "url"
  | "text";

export type QrCodeStatus = "active" | "archived";

export type QrCodeDesign = {
  id: string;
  name: string;
  status: QrCodeStatus;
  targetType: QrCodeTargetType;
  targetConfig: Record<string, unknown>;
  designConfig: Record<string, unknown>;
  labelConfig: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

type QrCodeDesignRow = {
  id: string;
  name: string;
  status: string | null;
  target_type: string | null;
  target_config: Record<string, unknown> | null;
  design_config: Record<string, unknown> | null;
  label_config: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

const qrCodeColumns =
  "id,name,status,target_type,target_config,design_config,label_config,created_at,updated_at";
const missingQrCodeTableMessage =
  "QR-code tabel ontbreekt. Voer supabase/migrations/035_qr_code_designs.sql uit in Supabase.";

function isMissingQrCodeTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("qr_code_designs") ||
    error.message?.includes("schema cache")
  );
}

function mapQrCodeDesign(row: QrCodeDesignRow): QrCodeDesign {
  return {
    id: row.id,
    name: row.name,
    status: row.status === "archived" ? "archived" : "active",
    targetType: (row.target_type ?? "url") as QrCodeTargetType,
    targetConfig: row.target_config ?? {},
    designConfig: row.design_config ?? {},
    labelConfig: row.label_config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listQrCodeDesigns() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qr_code_designs")
    .select(qrCodeColumns)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingQrCodeTableError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data as QrCodeDesignRow[]).map(mapQrCodeDesign);
}

export async function hasQrCodeDesignsTable() {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("qr_code_designs").select("id").limit(1);

  return !error || !isMissingQrCodeTableError(error);
}

export async function getQrCodeDesign(id: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qr_code_designs")
    .select(qrCodeColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingQrCodeTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? mapQrCodeDesign(data as QrCodeDesignRow) : null;
}

export async function upsertQrCodeDesign(input: {
  id?: string | null;
  name: string;
  status: QrCodeStatus;
  targetType: QrCodeTargetType;
  targetConfig: Record<string, unknown>;
  designConfig: Record<string, unknown>;
  labelConfig: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    name: input.name,
    status: input.status,
    target_type: input.targetType,
    target_config: input.targetConfig,
    design_config: input.designConfig,
    label_config: input.labelConfig,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase
        .from("qr_code_designs")
        .update(payload)
        .eq("id", input.id)
        .select(qrCodeColumns)
        .single()
    : supabase.from("qr_code_designs").insert(payload).select(qrCodeColumns).single();

  const { data, error } = await query;

  if (error) {
    if (isMissingQrCodeTableError(error)) {
      throw new Error(missingQrCodeTableMessage);
    }

    throw new Error(error.message);
  }

  return mapQrCodeDesign(data as QrCodeDesignRow);
}

export async function updateQrCodeStatus(id: string, status: QrCodeStatus) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("qr_code_designs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (isMissingQrCodeTableError(error)) {
      throw new Error(missingQrCodeTableMessage);
    }

    throw new Error(error.message);
  }
}

export async function deleteQrCodeDesign(id: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("qr_code_designs").delete().eq("id", id);

  if (error) {
    if (isMissingQrCodeTableError(error)) {
      throw new Error(missingQrCodeTableMessage);
    }

    throw new Error(error.message);
  }
}
