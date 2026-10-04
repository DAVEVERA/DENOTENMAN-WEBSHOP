import type { NextRequest } from "next/server";

import { canvaConnectionSummary } from "@/lib/canva/connection";
import { canvaJson, requireCanvaAdmin } from "@/lib/canva/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireCanvaAdmin(request);
  if (guard.response) return guard.response;
  return canvaJson({ ...(await canvaConnectionSummary()), canManage: guard.admin.role === "OWNER" || guard.admin.role === "ADMIN" });
}
