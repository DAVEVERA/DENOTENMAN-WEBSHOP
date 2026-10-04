import type { NextRequest } from "next/server";

import { disconnectCanva } from "@/lib/canva/connection";
import { canvaErrorResponse, canvaJson, requireCanvaAdmin } from "@/lib/canva/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = await requireCanvaAdmin(request, { manage: true });
  if (guard.response) return guard.response;
  try {
    await disconnectCanva();
    return canvaJson({ ok: true });
  } catch (error) {
    return canvaErrorResponse(error);
  }
}
