import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  hasProductWritePermission,
  isSameOriginMutation,
} from "@/lib/admin-request-security";
import { priceMonitorMatchReviewSchema } from "@/lib/price-monitor/inputs";
import {
  PriceMonitorServiceError,
  reviewPriceMonitorMatch,
} from "@/lib/price-monitor/service";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasProductWritePermission(admin.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const parsed = priceMonitorMatchReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const { id } = await context.params;
    await reviewPriceMonitorMatch({ matchId: id, decision: parsed.data.decision, admin });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PriceMonitorServiceError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("Price monitor match review failed", { adminUserId: admin.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
