import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type AdminMediaAsset = {
  name: string;
  path: string;
  bucket: string;
  size: number | null;
  updatedAt: string | null;
  publicUrl: string;
};

async function listFolder(bucket: string, folder = "", depth = 0): Promise<AdminMediaAsset[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).list(folder || undefined, {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });

  if (error) throw new Error(error.message);

  const assets: AdminMediaAsset[] = [];

  for (const item of data ?? []) {
    const path = folder ? `${folder}/${item.name}` : item.name;
    const isFolder = !item.id && depth < 2;

    if (isFolder) {
      assets.push(...(await listFolder(bucket, path, depth + 1)));
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
    assets.push({
      name: item.name,
      path,
      bucket,
      size: item.metadata?.size ? Number(item.metadata.size) : null,
      updatedAt: item.updated_at ?? item.created_at ?? null,
      publicUrl: publicUrlData.publicUrl,
    });
  }

  return assets;
}

export async function listAdminMediaAssets() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("bucket,object_path,public_url,filename,mime_type,size_bytes,updated_at,created_at")
    .order("updated_at", { ascending: false });

  if (!error && data && data.length > 0) {
    return data.map((row: any) => ({
      name: String(row.filename ?? row.object_path),
      path: String(row.object_path),
      bucket: String(row.bucket),
      size: row.size_bytes === null ? null : Number(row.size_bytes),
      updatedAt: row.updated_at ?? row.created_at ?? null,
      publicUrl: String(row.public_url),
    }));
  }

  const buckets = ["product-images"];
  const results = await Promise.all(
    buckets.map((bucket) => listFolder(bucket).catch(() => [] satisfies AdminMediaAsset[])),
  );

  return results
    .flat()
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
}
