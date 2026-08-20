import { NextResponse, type NextRequest } from "next/server";
import type { AdminUser } from "@prisma/client";
import { authenticateCostOverview } from "@/lib/cost-overview-auth";
import { CostOverviewError } from "@/lib/cost-overview";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { isValidIdempotencyKey } from "@/lib/cost-overview-schema";

const JSON_BODY_MAX_BYTES = 32 * 1024;

export async function authorizeCostRequest(
  request: NextRequest,
  write: boolean,
): Promise<{ admin: AdminUser; canManage: boolean } | NextResponse> {
  const authorization = await authenticateCostOverview(request);
  if (!authorization.admin) return costJson({ error: "UNAUTHORIZED" }, 401);
  if (write && !authorization.canManage)
    return costJson({ error: "FORBIDDEN" }, 403);
  if (write && !isSameOriginMutation(request))
    return costJson({ error: "INVALID_ORIGIN" }, 403);
  return { admin: authorization.admin, canManage: authorization.canManage };
}

export function requireCostIdempotencyKey(
  request: NextRequest,
): string | NextResponse {
  const value = request.headers.get("idempotency-key");
  return isValidIdempotencyKey(value)
    ? value
    : costJson({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
}

export async function parseCostJson(
  request: NextRequest,
): Promise<unknown | NextResponse> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsed = Number(contentLength);
    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 0 ||
      parsed > JSON_BODY_MAX_BYTES
    ) {
      return costJson(
        { error: "INVALID_BODY_SIZE" },
        parsed > JSON_BODY_MAX_BYTES ? 413 : 400,
      );
    }
  }
  try {
    return await request.json();
  } catch {
    return costJson({ error: "INVALID_BODY" }, 400);
  }
}

export function costErrorResponse(error: unknown): NextResponse {
  if (error instanceof CostOverviewError)
    return costJson({ error: error.code }, error.status);
  console.error("Cost overview operation failed", {
    error: error instanceof Error ? error.name : "UnknownError",
  });
  return costJson({ error: "INTERNAL_ERROR" }, 500);
}

export function costJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
