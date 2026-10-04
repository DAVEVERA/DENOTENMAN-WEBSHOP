import type { NextRequest } from "next/server";
import { z } from "zod";

import { canvaErrorResponse, canvaJson, requireCanvaAdmin } from "@/lib/canva/http";
import { safeAdminPath } from "@/lib/canva/return-token";
import { createBlankCanvaDesign, createCanvaDesignFromImage, listCanvaDesigns } from "@/lib/canva/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireCanvaAdmin(request);
  if (guard.response) return guard.response;
  const params = request.nextUrl.searchParams;
  try {
    return canvaJson(await listCanvaDesigns(params.get("query") ?? undefined, params.get("continuation") ?? undefined));
  } catch (error) {
    return canvaErrorResponse(error);
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  width: z.number().int().min(40).max(8000).optional(),
  height: z.number().int().min(40).max(8000).optional(),
  /** Start from one of our images instead of a blank page. */
  imageUrl: z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u).optional(),
  returnTo: z.string().max(300).optional(),
  pickerId: z.string().regex(/^[\w-]{1,40}$/u).optional(),
}).strict().refine((input) => Boolean(input.imageUrl || (input.width && input.height)), { message: "Kies een formaat of een afbeelding." });

export async function POST(request: NextRequest) {
  const guard = await requireCanvaAdmin(request, { mutate: true });
  if (guard.response) return guard.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return canvaJson({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Controleer de invoer." }, 422);
  const { title, width, height, imageUrl, returnTo, pickerId } = parsed.data;
  const correlation = { returnTo: safeAdminPath(returnTo), pickerId: pickerId ?? null };
  try {
    const design = imageUrl
      ? await createCanvaDesignFromImage({ imageUrl, title }, correlation)
      : await createBlankCanvaDesign({ title, width: width ?? 1200, height: height ?? 600 }, correlation);
    return canvaJson({ design }, 201);
  } catch (error) {
    return canvaErrorResponse(error);
  }
}
