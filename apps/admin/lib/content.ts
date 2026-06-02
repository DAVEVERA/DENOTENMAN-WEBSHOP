import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type AdminContentItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category?: string | null;
  content?: string | null;
  updatedAt: string | null;
};

function mapContentItem(row: any): AdminContentItem {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    status: String(row.status ?? "draft"),
    category: row.category ?? null,
    content: row.content ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
}

export async function listCmsPages() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("cms_pages")
    .select("id,title,slug,status,content,updated_at,created_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentItem);
}

export async function getCmsPage(id: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("cms_pages")
    .select("id,title,slug,status,content,updated_at,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapContentItem(data) : null;
}

export async function upsertCmsPage(input: {
  id?: string | null;
  title: string;
  slug: string;
  content: string | null;
  status: string;
}) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    slug: input.slug,
    content: input.content,
    status: input.status,
    published_at: input.status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("cms_pages").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function listBlogPosts() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id,title,slug,category,status,content,updated_at,created_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentItem);
}

export async function getBlogPost(id: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id,title,slug,category,status,content,updated_at,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapContentItem(data) : null;
}

export async function upsertBlogPost(input: {
  id?: string | null;
  title: string;
  slug: string;
  category: string | null;
  content: string | null;
  status: string;
}) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    slug: input.slug,
    category: input.category,
    content: input.content,
    status: input.status,
    published_at: input.status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("blog_posts").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
