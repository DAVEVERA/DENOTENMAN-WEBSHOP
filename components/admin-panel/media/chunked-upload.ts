import type { SocialMediaDto } from "@/lib/social/media";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "Uploaden mislukt.");
  return body;
}

/**
 * Uploads a photo, GIF or video in 8 MB chunks through the admin API into the public
 * media bucket, reporting progress from 0 to 100. Used by the social composer and the
 * newsletter editor.
 */
export async function uploadMediaInChunks(file: File, onProgress: (percent: number) => void): Promise<SocialMediaDto> {
  const start = await api<{ id: string; chunkBytes: number }>("/api/admin/social/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  for (let offset = 0; offset < file.size; offset += start.chunkBytes) {
    const chunk = file.slice(offset, Math.min(offset + start.chunkBytes, file.size));
    await api(`/api/admin/social/media/${encodeURIComponent(start.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream", "x-upload-offset": String(offset) },
      body: chunk,
    });
    onProgress(Math.round(((offset + chunk.size) / file.size) * 100));
  }
  return (await api<{ media: SocialMediaDto }>(`/api/admin/social/media/${encodeURIComponent(start.id)}`, { method: "POST" })).media;
}
