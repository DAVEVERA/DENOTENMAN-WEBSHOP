import type { AdminUser } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { hasProductWritePermission, isSameOriginMutation } from "@/lib/admin-request-security";
import { ProductFaqError } from "@/lib/product-faq-db";

export async function authorizeFaqRequest(request: NextRequest, mutation = false): Promise<AdminUser | NextResponse> {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasProductWritePermission(admin.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (mutation && !isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  return admin;
}

export function faqErrorResponse(error: unknown): NextResponse {
  if (error instanceof ProductFaqError) {
    const status = error.code === "PRODUCT_NOT_FOUND" || error.code === "FAQ_NOT_FOUND" ? 404
      : error.code === "STALE_FAQ_SET" || error.code === "STALE_FAQ_ITEM" || error.code === "IDEMPOTENCY_CONFLICT" ? 409
      : 400;
    return NextResponse.json({ error: error.code }, { status });
  }
  console.error("Product FAQ mutation failed", error);
  return NextResponse.json({ error: "FAQ_MUTATION_FAILED" }, { status: 500 });
}

export async function parseJson(request: NextRequest): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
}
