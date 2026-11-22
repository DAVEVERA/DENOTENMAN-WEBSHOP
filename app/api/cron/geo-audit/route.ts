import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runScheduledGeoAudit } from "@/lib/ai-vindbaarheid/scheduled-audit";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** Call from the existing Cloud Scheduler infrastructure every 5 minutes.
 * Each invocation processes at most six products; a complete scan recurs weekly.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.GEO_AUDIT_CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runScheduledGeoAudit();
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Scheduled GEO catalogue audit failed", error);
    return NextResponse.json({ error: "AUDIT_FAILED" }, { status: 500 });
  }
}
