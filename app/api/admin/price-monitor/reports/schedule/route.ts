import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  hasProductWritePermission,
  isSameOriginMutation,
} from "@/lib/admin-request-security";
import { priceMonitorScheduleSchema } from "@/lib/price-monitor/inputs";
import { savePriceMonitorSchedule } from "@/lib/price-monitor/service";

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasProductWritePermission(admin.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const parsed = priceMonitorScheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    await savePriceMonitorSchedule({ ...parsed.data, admin });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Price monitor schedule save failed", { adminUserId: admin.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
