"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "../lib/audit";
import { requireAdmin } from "../lib/admin-auth";
import {
  deleteQrCodeDesign,
  updateQrCodeStatus,
  upsertQrCodeDesign,
  type QrCodeStatus,
  type QrCodeTargetType,
} from "../lib/qrcodes";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonObject(value: string, key: string) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new Error(`Ongeldige JSON voor ${key}.`);
  }
}

export async function saveQrCodeAction(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id") || null;
  const name = getString(formData, "name");

  if (!name) {
    throw new Error("Naam is verplicht.");
  }

  const design = await upsertQrCodeDesign({
    id,
    name,
    status: (getString(formData, "status") || "active") as QrCodeStatus,
    targetType: (getString(formData, "targetType") || "url") as QrCodeTargetType,
    targetConfig: parseJsonObject(getString(formData, "targetConfig"), "targetConfig"),
    designConfig: parseJsonObject(getString(formData, "designConfig"), "designConfig"),
    labelConfig: parseJsonObject(getString(formData, "labelConfig"), "labelConfig"),
  });

  await createAuditLog({
    actorEmail: session.email,
    action: id ? "QR-code bijgewerkt" : "QR-code aangemaakt",
    entityType: "qr_code",
    entityId: design.id,
  });

  revalidatePath("/qrcodes");
  revalidatePath(`/qrcodes/${design.id}`);
  redirect(`/qrcodes/${design.id}`);
}

export async function archiveQrCodeAction(formData: FormData) {
  await setQrCodeStatus(formData, "archived", "QR-code gearchiveerd");
}

export async function restoreQrCodeAction(formData: FormData) {
  await setQrCodeStatus(formData, "active", "QR-code hersteld");
}

async function setQrCodeStatus(formData: FormData, status: QrCodeStatus, action: string) {
  const session = await requireAdmin();
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("QR-code-id ontbreekt.");
  }

  await updateQrCodeStatus(id, status);
  await createAuditLog({
    actorEmail: session.email,
    action,
    entityType: "qr_code",
    entityId: id,
  });

  revalidatePath("/qrcodes");
  revalidatePath(`/qrcodes/${id}`);
}

export async function deleteQrCodeAction(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("QR-code-id ontbreekt.");
  }

  await deleteQrCodeDesign(id);
  await createAuditLog({
    actorEmail: session.email,
    action: "QR-code verwijderd",
    entityType: "qr_code",
    entityId: id,
  });

  revalidatePath("/qrcodes");
  redirect("/qrcodes");
}
