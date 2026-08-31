import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { getApexScanPage } from "@/lib/price-monitor/apex-scan";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") ?? "").slice(0, 120);
  const source = (searchParams.get("source") ?? "").slice(0, 120);
  const offset = boundedInteger(searchParams.get("offset"), 0, 0, 100_000);
  const limit = boundedInteger(searchParams.get("limit"), 50, 1, 100);

  return NextResponse.json(
    getApexScanPage({ query, source, offset, limit }),
    {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    }
  );
}

function boundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
