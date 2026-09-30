import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import { startSocialUpload } from "@/lib/social/media";

export const runtime = "nodejs";

const startSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
}).strict();

// Starts an upload; the composer then sends the file in chunks to /media/[id].
export async function POST(request: NextRequest) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson(await startSocialUpload(startSchema.parse(await request.json().catch(() => null))), 201);
  } catch (error) {
    return socialErrorResponse(error);
  }
}
