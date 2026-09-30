import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import { BASE_URL } from "@/lib/routes";
import { mapSocialError } from "./service";

export const SOCIAL_STATE_COOKIE = "denotenman_social_oauth_state";

export function socialJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function socialErrorResponse(error: unknown) {
  const mapped = mapSocialError(error);
  return socialJson(mapped.body, mapped.status);
}

/**
 * Admin guard for the social poster. Reading is open to every admin; anything that
 * changes posts or reaches the public channels is limited to owners and admins.
 */
export async function requireSocialAdmin(request: NextRequest, options: { write?: boolean } = {}) {
  const admin = await getAdminSession(request);
  if (!admin) return { response: socialJson({ error: "UNAUTHORIZED", message: "Log opnieuw in." }, 401) };
  if (options.write) {
    if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
      return { response: socialJson({ error: "FORBIDDEN", message: "Alleen een owner of admin kan berichten plannen en plaatsen." }, 403) };
    }
    if (!hasSameOrigin(request)) return { response: socialJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403) };
  }
  return { admin };
}

export function socialRedirectUri(key: string): string {
  return `${BASE_URL.replace(/\/+$/u, "")}/api/admin/social/callback/${key}`;
}
