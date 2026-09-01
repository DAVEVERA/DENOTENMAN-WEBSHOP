import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  hasProductWritePermission,
  isSameOriginMutation,
} from "@/lib/admin-request-security";
import {
  createApexLocalSession,
  getApexLocalRunView,
} from "@/lib/price-monitor/apex-local";
import { PriceMonitorServiceError } from "@/lib/price-monitor/service";

export const dynamic = "force-dynamic";

const startSchema = z.object({
  domain: z.string().trim().toLowerCase().min(4).max(120),
  limit: z.coerce.number().int().min(1).max(25),
});

const statusSchema = z.object({
  runId: z.string().trim().min(10).max(80),
});

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return privateJson({ error: "UNAUTHORIZED" }, 401);
  const parsed = statusSchema.safeParse({
    runId: request.nextUrl.searchParams.get("runId") || "",
  });
  if (!parsed.success) return privateJson({ error: "VALIDATION_ERROR" }, 400);
  try {
    return privateJson(await getApexLocalRunView({
      runId: parsed.data.runId,
      adminId: admin.id,
    }));
  } catch (error) {
    return serviceError(error, "Local APEX status failed");
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return privateJson({ error: "UNAUTHORIZED" }, 401);
  if (!hasProductWritePermission(admin.role)) {
    return privateJson({ error: "FORBIDDEN" }, 403);
  }
  if (!isSameOriginMutation(request)) {
    return privateJson({ error: "INVALID_ORIGIN" }, 403);
  }
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: "VALIDATION_ERROR" }, 400);
  try {
    return privateJson(await createApexLocalSession({ ...parsed.data, admin }), 201);
  } catch (error) {
    return serviceError(error, "Local APEX session start failed");
  }
}

function serviceError(error: unknown, message: string) {
  if (error instanceof PriceMonitorServiceError) {
    return privateJson({ error: error.code }, error.status);
  }
  console.error(message, { error });
  return privateJson({ error: "INTERNAL_ERROR" }, 500);
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
