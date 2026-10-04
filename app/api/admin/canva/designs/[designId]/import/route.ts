import type { NextRequest } from "next/server";
import { z } from "zod";

import { canvaErrorResponse, canvaJson, requireCanvaAdmin } from "@/lib/canva/http";
import { importCanvaDesign } from "@/lib/canva/service";

export const runtime = "nodejs";
// Exports can take a while for designs with many pages.
export const maxDuration = 120;

type Context = { params: Promise<{ designId: string }> };

const inputSchema = z.object({
  format: z.enum(["png", "jpg"]).default("png"),
  pages: z.array(z.number().int().min(1).max(500)).min(1).max(20).optional(),
}).strict();

// Exports a Canva design and stores the result in the media library.
export async function POST(request: NextRequest, context: Context) {
  const guard = await requireCanvaAdmin(request, { mutate: true });
  if (guard.response) return guard.response;
  const designId = (await context.params).designId;
  if (!/^[\w-]{1,64}$/u.test(designId)) return canvaJson({ error: "INVALID_DESIGN", message: "Onbekend design." }, 422);
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return canvaJson({ error: "INVALID_INPUT", message: "Kies PNG of JPG." }, 422);
  try {
    return canvaJson({ images: await importCanvaDesign(designId, { ...parsed.data, adminId: guard.admin.id }) });
  } catch (error) {
    return canvaErrorResponse(error);
  }
}
