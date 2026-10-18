import "server-only";

import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import {
  GOOGLE_PLACE_ID_SETTING_KEY,
  parsePlaceDetails,
  placeDetailsRequest,
  snapshotDay,
} from "@/lib/google-reviews";

const REQUEST_TIMEOUT_MS = 10_000;

export type CaptureSnapshotResult =
  | { status: "stored"; rating: number; reviewCount: number }
  | { status: "skipped"; reason: "NOT_CONFIGURED" }
  | { status: "failed"; error: string };

/**
 * Reads the rating once and stores it under today's date.
 *
 * A missing place id or API key is not a failure worth alarming about: the
 * feature is simply not configured yet, and the pages that read this series all
 * render an empty state. Network and parse problems come back as `failed` with
 * a reason rather than as a thrown error, so one bad day never stops the job.
 */
export async function captureGoogleReviewSnapshot(now: Date): Promise<CaptureSnapshotResult> {
  const placeId = (await getSetting(GOOGLE_PLACE_ID_SETTING_KEY))?.trim();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!placeId || !apiKey) return { status: "skipped", reason: "NOT_CONFIGURED" };

  const request = placeDetailsRequest(placeId, apiKey);
  let body: unknown;
  try {
    const response = await fetch(request.url, {
      headers: request.headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    body = await response.json().catch(() => null);
    if (!response.ok) {
      return { status: "failed", error: `Google antwoordde met status ${response.status}.` };
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "onbekende netwerkfout";
    return { status: "failed", error: `Google was niet bereikbaar: ${reason}` };
  }

  const rating = parsePlaceDetails(body);
  if (!rating) {
    return { status: "failed", error: "Het antwoord van Google bevatte geen bruikbare rating." };
  }

  const capturedOn = snapshotDay(now);
  await prisma.googleReviewSnapshot.upsert({
    where: { capturedOn },
    create: { capturedOn, rating: rating.rating, reviewCount: rating.reviewCount },
    update: { rating: rating.rating, reviewCount: rating.reviewCount },
  });

  return { status: "stored", rating: rating.rating, reviewCount: rating.reviewCount };
}
