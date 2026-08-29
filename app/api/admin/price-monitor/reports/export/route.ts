import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { getPriceMonitorDashboard } from "@/lib/price-monitor/service";
import { priceMonitorCsv, priceMonitorJson } from "@/lib/price-monitor/report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase() || "csv";
  if (format !== "csv" && format !== "json") {
    return NextResponse.json({ error: "UNSUPPORTED_FORMAT" }, { status: 400 });
  }
  try {
    const dashboard = await getPriceMonitorDashboard();
    const date = new Date().toISOString().slice(0, 10);
    const body = format === "json" ? priceMonitorJson(dashboard) : priceMonitorCsv(dashboard);
    return new NextResponse(body, {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `attachment; filename="prijsmonitor-${date}.${format}"`,
        "content-type":
          format === "json"
            ? "application/json; charset=utf-8"
            : "text/csv; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Price monitor export failed", { adminUserId: admin.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
