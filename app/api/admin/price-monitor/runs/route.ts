import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  hasProductWritePermission,
  isSameOriginMutation,
} from "@/lib/admin-request-security";
import { priceMonitorRunInputSchema } from "@/lib/price-monitor/inputs";
import {
  PriceMonitorServiceError,
  processPriceMonitorSourceRun,
  queuePriceMonitorSourceRun,
} from "@/lib/price-monitor/service";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasProductWritePermission(admin.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const parsed = priceMonitorRunInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const queued = await queuePriceMonitorSourceRun({ ...parsed.data, admin });
    after(async () => {
      try {
        await processPriceMonitorSourceRun({ runId: queued.runId });
      } catch (error) {
        console.error("Background price monitor run failed", {
          runId: queued.runId,
          sourceKey: parsed.data.sourceKey,
          error,
        });
      }
    });
    return NextResponse.json(queued, { status: 202 });
  } catch (error) {
    if (error instanceof PriceMonitorServiceError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("Price monitor run failed", { sourceKey: parsed.data.sourceKey, adminUserId: admin.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
