import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { getAdminDashboardAnalytics } from "@/lib/admin-dashboard-analytics";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("refresh") === "1";
  const data = await getAdminDashboardAnalytics({ force });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
