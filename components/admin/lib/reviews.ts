import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export async function listAdminReviews() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id,customer_name,customer_email,rating,title,status,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    customer: row.customer_name ?? row.customer_email ?? "Onbekende klant",
    rating: Number(row.rating ?? 0),
    title: row.title ?? "Review zonder titel",
    status: String(row.status ?? "pending"),
    createdAt: row.created_at ?? null,
  }));
}
