/**
 * Reading the shop's own Google rating.
 *
 * The Places API gives the aggregate rating and the review total for a place
 * with nothing but an API key. The full review texts need the Business Profile
 * API, which is a separate access request at Google; this module deliberately
 * stops at the aggregate, which is all the analysis and the rating widget use.
 *
 * Prisma-free so the parsing is testable without a database; the snapshot write
 * lives in lib/google-reviews-db.ts.
 */

export const GOOGLE_PLACE_ID_SETTING_KEY = "reviews.googlePlaceId";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/** Highest rating Google awards; anything above it is a body we misread. */
const MAX_RATING = 5;

export type GoogleRating = {
  rating: number;
  reviewCount: number;
};

export type PlaceDetailsRequest = {
  url: string;
  headers: Record<string, string>;
};

/** A field mask keeps the response, and the billing tier, down to what we use. */
export function placeDetailsRequest(placeId: string, apiKey: string): PlaceDetailsRequest {
  return {
    url: `${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`,
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount",
      Accept: "application/json",
    },
  };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_RATING;
}

/**
 * Returns null for anything that is not plainly a rating and a count. A guessed
 * number here would be written into the snapshot series and show up on the
 * dashboard as fact.
 */
export function parsePlaceDetails(body: unknown): GoogleRating | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!isRating(record.rating) || !isCount(record.userRatingCount)) return null;
  return { rating: record.rating, reviewCount: record.userRatingCount };
}

export function latestRating(
  snapshots: Array<{ capturedOn: Date; rating: number; reviewCount: number }>
): GoogleRating | null {
  let newest: { capturedOn: Date; rating: number; reviewCount: number } | null = null;
  for (const snapshot of snapshots) {
    if (!newest || snapshot.capturedOn.getTime() > newest.capturedOn.getTime()) {
      newest = snapshot;
    }
  }
  return newest ? { rating: newest.rating, reviewCount: newest.reviewCount } : null;
}

/** The date key a snapshot is stored under: a bare UTC day. */
export function snapshotDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Which half of the rating configuration is missing, if either. */
export type MissingRatingConfig = "NO_PLACE_ID" | "NO_API_KEY";

/**
 * Names the piece that is actually absent. One combined "not configured"
 * message makes an admin doubt the value they just filled in, so the place id
 * and the API key are reported apart. The place id comes first when both are
 * missing: that is the one an admin can fix in Instellingen without Cloud Run
 * access.
 */
export function missingRatingConfig(
  placeId: string | null | undefined,
  apiKey: string | null | undefined
): MissingRatingConfig | null {
  if (!placeId?.trim()) return "NO_PLACE_ID";
  if (!apiKey?.trim()) return "NO_API_KEY";
  return null;
}
