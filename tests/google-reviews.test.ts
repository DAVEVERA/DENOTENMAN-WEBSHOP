import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  GOOGLE_PLACE_ID_SETTING_KEY,
  latestRating,
  parsePlaceDetails,
  placeDetailsRequest,
} from "../lib/google-reviews";

test("place details are read from rating and userRatingCount", () => {
  assert.deepEqual(parsePlaceDetails({ rating: 4.7, userRatingCount: 128 }), {
    rating: 4.7,
    reviewCount: 128,
  });
  assert.deepEqual(parsePlaceDetails({ rating: 5, userRatingCount: 1 }), {
    rating: 5,
    reviewCount: 1,
  });
});

test("an unusable place details body yields null rather than a guess", () => {
  for (const body of [
    null,
    undefined,
    {},
    "4.7",
    { rating: "4.7", userRatingCount: 128 },
    { rating: 4.7 },
    { userRatingCount: 128 },
    { rating: Number.NaN, userRatingCount: 1 },
    { rating: 4.7, userRatingCount: -1 },
    { rating: 6, userRatingCount: 10 },
  ]) {
    assert.equal(parsePlaceDetails(body), null, `${JSON.stringify(body)} should not parse`);
  }
});

test("a place with no reviews yet parses as a real zero", () => {
  assert.deepEqual(parsePlaceDetails({ rating: 0, userRatingCount: 0 }), {
    rating: 0,
    reviewCount: 0,
  });
});

test("latest rating returns null on an empty series", () => {
  assert.equal(latestRating([]), null);
});

test("latest rating picks the newest snapshot whatever the input order", () => {
  const snapshots = [
    { capturedOn: new Date("2026-10-10T00:00:00Z"), rating: 4.5, reviewCount: 100 },
    { capturedOn: new Date("2026-10-18T00:00:00Z"), rating: 4.7, reviewCount: 110 },
    { capturedOn: new Date("2026-10-14T00:00:00Z"), rating: 4.6, reviewCount: 105 },
  ];
  assert.deepEqual(latestRating(snapshots), { rating: 4.7, reviewCount: 110 });
});

test("the place details request asks Google for only the two fields it needs", () => {
  const request = placeDetailsRequest("PLACE_123", "KEY_abc");
  assert.equal(request.url, "https://places.googleapis.com/v1/places/PLACE_123");
  assert.equal(request.headers["X-Goog-Api-Key"], "KEY_abc");
  assert.equal(request.headers["X-Goog-FieldMask"], "rating,userRatingCount");
});

test("a place id is url-encoded into the request path", () => {
  const request = placeDetailsRequest("a/b?c", "KEY");
  assert.ok(!request.url.includes("a/b?c"));
  assert.ok(request.url.endsWith("a%2Fb%3Fc"));
});

test("the place id setting key is namespaced with the other review settings", () => {
  assert.equal(GOOGLE_PLACE_ID_SETTING_KEY, "reviews.googlePlaceId");
});

test("the cron route refuses a request without the bearer secret", async () => {
  const source = await readFile("app/api/cron/google-reviews/route.ts", "utf8");
  assert.match(source, /timingSafeEqual/, "the secret is not compared in constant time");
  assert.match(source, /401/, "an unauthorised call is not rejected");
  assert.match(source, /GOOGLE_REVIEWS_CRON_SECRET/);
  assert.match(source, /export async function POST/, "the cron entry point is not a POST");
  assert.ok(!/export async function GET/.test(source), "a cron secret must not sit in a GET");
});
