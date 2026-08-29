import { NextResponse, type NextRequest } from "next/server";
import { sendDuePriceMonitorReports } from "@/lib/price-monitor/email";

export async function POST(request: NextRequest) {
  const configured = process.env.PRICE_MONITOR_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!configured || configured.length < 24 || !supplied || !(await secureEqual(configured, supplied))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await sendDuePriceMonitorReports()) });
  } catch (error) {
    console.error("Scheduled price reports failed", { error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}
