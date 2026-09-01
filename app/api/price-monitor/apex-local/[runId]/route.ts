import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import {
  acceptApexLocalUpload,
  apexLocalUploadSchema,
} from "@/lib/price-monitor/apex-local";
import { PriceMonitorServiceError } from "@/lib/price-monitor/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 2_000_000;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  if (!/^[a-z0-9]{10,80}$/i.test(runId)) {
    return privateJson({ error: "VALIDATION_ERROR" }, 400);
  }
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 2_000) {
    return privateJson({ error: "APEX_UPLOAD_TOKEN_INVALID" }, 401);
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return privateJson({ error: "APEX_UPLOAD_TOO_LARGE" }, 413);
  }

  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_UPLOAD_BYTES) {
    return privateJson({ error: "APEX_UPLOAD_TOO_LARGE" }, 413);
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return privateJson({ error: "VALIDATION_ERROR" }, 400);
  }
  const parsed = apexLocalUploadSchema.safeParse(json);
  if (!parsed.success) return privateJson({ error: "VALIDATION_ERROR" }, 400);

  try {
    const result = await acceptApexLocalUpload({ runId, token, upload: parsed.data });
    return privateJson(result);
  } catch (error) {
    if (error instanceof PriceMonitorServiceError) {
      return privateJson({ error: error.code }, error.status);
    }
    console.error("Local APEX upload failed", { runId, error });
    return privateJson({ error: "INTERNAL_ERROR" }, 500);
  }
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
