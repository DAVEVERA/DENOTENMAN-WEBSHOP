"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import { slugifyProductName } from "../lib/products";
import { upsertBlogPost, upsertCmsPage } from "../lib/content";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveCmsPageAction(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id") || null;
  const title = getString(formData, "title");
  const slug = getString(formData, "slug") || slugifyProductName(title);

  if (!title || !slug) throw new Error("Titel en slug zijn verplicht.");

  await upsertCmsPage({
    id,
    title,
    slug,
    content: getString(formData, "content") || null,
    status: getString(formData, "status") || "draft",
  });
  await createAuditLog({
    actorEmail: session.email,
    action: id ? "CMS-pagina bijgewerkt" : "CMS-pagina aangemaakt",
    entityType: "cms_page",
    entityId: id ?? slug,
  });
  revalidatePath("/cms/paginas");
  redirect("/cms/paginas");
}

export async function saveBlogPostAction(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id") || null;
  const title = getString(formData, "title");
  const slug = getString(formData, "slug") || slugifyProductName(title);

  if (!title || !slug) throw new Error("Titel en slug zijn verplicht.");

  await upsertBlogPost({
    id,
    title,
    slug,
    category: getString(formData, "category") || null,
    content: getString(formData, "content") || null,
    status: getString(formData, "status") || "draft",
  });
  await createAuditLog({
    actorEmail: session.email,
    action: id ? "Blogpost bijgewerkt" : "Blogpost aangemaakt",
    entityType: "blog_post",
    entityId: id ?? slug,
  });
  revalidatePath("/cms/blog");
  redirect("/cms/blog");
}
