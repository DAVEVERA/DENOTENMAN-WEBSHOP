"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import { slugifyProductName } from "../lib/products";
import { createAdminSupabaseClient } from "../lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveCategoryAction(formData: FormData) {
  const session = await requireAdmin();
  const name = getString(formData, "name");
  const slug = getString(formData, "slug") || slugifyProductName(name);

  if (!name || !slug) throw new Error("Categorienaam en slug zijn verplicht.");

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("categories").upsert(
    {
      id: slug,
      name,
      slug,
      description: getString(formData, "description") || null,
      is_active: formData.get("isActive") === "on",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
  await createAuditLog({
    actorEmail: session.email,
    action: "Categorie opgeslagen",
    entityType: "category",
    entityId: slug,
  });
  revalidatePath("/categorieen");
  redirect("/categorieen");
}
