import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { captureGoogleReviewSnapshot } from "@/lib/google-reviews-db";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called once a day by Cloud Scheduler: records the Google rating and review
// total for today. That series is the only source for the review analysis and
// the rating widget, so a day without a run simply leaves a gap.
export async function POST(request: NextRequest) {
  const secret = process.env.GOOGLE_REVIEWS_CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await captureGoogleReviewSnapshot(new Date());
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
  } catch (error) {
    console.error("Failed to capture the Google review snapshot", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
