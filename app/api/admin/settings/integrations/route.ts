import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { getProviderStatusReport } from "@/lib/provider-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const report = await getProviderStatusReport();
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
