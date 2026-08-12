"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import { createAdminSupabaseClient } from "../lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveAdminSettingAction(formData: FormData) {
  const session = await requireAdmin();
  const key = getString(formData, "key");

  if (!key) throw new Error("Instellingssleutel ontbreekt.");

  const value: Record<string, string> = {};
  for (const [fieldKey, fieldValue] of formData.entries()) {
    if (fieldKey === "key" || typeof fieldValue !== "string") continue;
    value[fieldKey] = fieldValue.trim();
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("admin_settings").upsert(
    {
      key,
      value,
      updated_by: session.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);
  await createAuditLog({
    actorEmail: session.email,
    action: "Instelling opgeslagen",
    entityType: "admin_setting",
    entityId: key,
  });
  revalidatePath("/instellingen");
}
