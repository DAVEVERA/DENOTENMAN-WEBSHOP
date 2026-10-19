import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { captureGoogleReviewSnapshot } from "@/lib/google-reviews-db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Takes one rating reading on demand. The daily cron does the same thing; this
 * exists so the rating is visible the moment the place id and API key are set,
 * instead of after the first scheduled run.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  try {
    const result = await captureGoogleReviewSnapshot(new Date());
    if (result.status === "failed") {
      return NextResponse.json({ ...result, message: result.error }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to measure the Google rating", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
