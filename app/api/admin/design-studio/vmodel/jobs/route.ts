import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin, validIdempotencyKey } from "@/lib/design-studio/http";
import { mapDesignStudioError } from "@/lib/design-studio/service";
import { vModelJobSchema } from "@/lib/design-studio/vmodel-schema";
import { createVModelCampaignJob } from "@/lib/design-studio/vmodel-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Alleen owners en admins mogen VModel gebruiken." }, { status: 403 });
  }
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!validIdempotencyKey(idempotencyKey)) {
    return NextResponse.json({ error: "INVALID_IDEMPOTENCY_KEY", message: "De aanvraagcode ontbreekt of is ongeldig." }, { status: 422 });
  }
  const parsed = vModelJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message || "Controleer de gekozen instellingen." }, { status: 422 });
  }
  try {
    const result = await createVModelCampaignJob({ adminUserId: admin.id, idempotencyKey, options: parsed.data });
    return NextResponse.json(result, {
      status: result.replayed ? 200 : 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const mapped = mapDesignStudioError(error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}
