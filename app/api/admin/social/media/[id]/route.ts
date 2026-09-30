import type { NextRequest } from "next/server";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import { appendSocialUploadChunk, completeSocialUpload, SOCIAL_UPLOAD_CHUNK_BYTES } from "@/lib/social/media";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

/** One chunk of the file; the x-upload-offset header says where it starts. */
export async function PUT(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    const offset = Number(request.headers.get("x-upload-offset"));
    if (!Number.isInteger(offset) || offset < 0) return socialJson({ error: "INVALID_OFFSET", message: "Ongeldig uploaddeel." }, 422);
    const chunk = Buffer.from(await request.arrayBuffer());
    if (!chunk.length || chunk.length > SOCIAL_UPLOAD_CHUNK_BYTES) return socialJson({ error: "INVALID_CHUNK", message: "Ongeldig uploaddeel." }, 422);
    return socialJson({ uploadedBytes: await appendSocialUploadChunk((await context.params).id, offset, chunk) });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

/** Finishes the upload once every chunk is stored. */
export async function POST(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson({ media: await completeSocialUpload((await context.params).id) });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
