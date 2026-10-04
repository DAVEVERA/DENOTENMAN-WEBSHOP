import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import { CanvaError } from "./api";

export const CANVA_STATE_COOKIE = "denotenman_canva_oauth";

export function canvaJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function canvaErrorResponse(error: unknown) {
  if (error instanceof CanvaError) return canvaJson({ error: error.code, message: error.message }, error.status);
  console.error("Canva request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  return canvaJson({ error: "CANVA_FAILED", message: "Canva kon dit niet uitvoeren. Probeer het opnieuw." }, 502);
}

/** Every admin may use Canva; connecting and disconnecting the shop account is for owners and admins. */
export async function requireCanvaAdmin(request: NextRequest, options: { mutate?: boolean; manage?: boolean } = {}) {
  const admin = await getAdminSession(request);
  if (!admin) return { response: canvaJson({ error: "UNAUTHORIZED", message: "Log opnieuw in." }, 401) };
  if (options.manage && admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return { response: canvaJson({ error: "FORBIDDEN", message: "Alleen een owner of admin kan Canva koppelen of ontkoppelen." }, 403) };
  }
  if ((options.mutate || options.manage) && !hasSameOrigin(request)) {
    return { response: canvaJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403) };
  }
  return { admin };
}
