import type { NextRequest } from "next/server";
import type { AdminRole } from "@prisma/client";
import { can } from "@/lib/roles";

export function hasProductWritePermission(role: AdminRole): boolean {
  return can(role, "products", "write");
}

/**
 * Browser mutation requests must carry an Origin matching the effective host.
 * This complements SameSite cookies and rejects cross-site form/fetch requests.
 */
export function isSameOriginMutation(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;

  try {
    const origin = new URL(originHeader);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.nextUrl.host;
    const expectedProtocol = forwardedProto ? `${forwardedProto}:` : request.nextUrl.protocol;
    return origin.host === expectedHost && origin.protocol === expectedProtocol;
  } catch {
    return false;
  }
}
