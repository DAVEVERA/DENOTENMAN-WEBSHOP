import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import { DEVELOPER_SESSION_COOKIE, verifyDeveloperSessionToken } from "./auth";
import { mapDeveloperError } from "./service";

export function developerJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function developerErrorResponse(error: unknown) {
  const mapped = mapDeveloperError(error);
  return developerJson(mapped.body, mapped.status);
}

/** The admin behind a request, but only when that admin also holds a developer session. */
export async function getDeveloperAdmin(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return null;
  return verifyDeveloperSessionToken(request.cookies.get(DEVELOPER_SESSION_COOKIE)?.value, admin.id) ? admin : null;
}

/** Guards developer-portal API calls: admin session, developer session and, for writes, same origin. */
export async function requireDeveloper(request: NextRequest, options: { write?: boolean } = {}) {
  const admin = await getDeveloperAdmin(request);
  if (!admin) return { response: developerJson({ error: "UNAUTHORIZED", message: "Log opnieuw in op het ontwikkelaarsportaal." }, 401) };
  if (options.write && !hasSameOrigin(request)) return { response: developerJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403) };
  return { admin };
}

/** Guards De Notenman's side (viewing and paying invoices): any active admin. */
export async function requireAdmin(request: NextRequest, options: { write?: boolean } = {}) {
  const admin = await getAdminSession(request);
  if (!admin) return { response: developerJson({ error: "UNAUTHORIZED", message: "Log opnieuw in." }, 401) };
  if (options.write && !hasSameOrigin(request)) return { response: developerJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403) };
  return { admin };
}

export async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}
