import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { GOOGLE_PLACE_ID_SETTING_KEY } from "../lib/google-reviews";
import { REVIEW_URL_SETTING_KEY } from "../lib/review-requests";

const EMAIL_LOGO = "public/brand/logo-wordmark-email.png";

test("the settings route accepts both review keys", async () => {
  const source = await readFile("app/api/admin/settings/route.ts", "utf8");
  // Either spelling is fine: the shared constant is the better one.
  assert.ok(
    source.includes(REVIEW_URL_SETTING_KEY) || source.includes("REVIEW_URL_SETTING_KEY"),
    "the review url key is not accepted"
  );
  assert.ok(
    source.includes(GOOGLE_PLACE_ID_SETTING_KEY) || source.includes("GOOGLE_PLACE_ID_SETTING_KEY"),
    "the place id key is not accepted"
  );
});

test("the settings route refuses a review url that is not a bare writereview link", async () => {
  const source = await readFile("app/api/admin/settings/route.ts", "utf8");
  assert.match(source, /isValidGoogleReviewUrl/, "the review url is stored without validation");
  assert.match(source, /400/, "an invalid review url is not rejected");
});

test("the settings form offers both review fields", async () => {
  const source = await readFile("app/admin/(dashboard)/instellingen/SettingsForm.tsx", "utf8");
  assert.ok(source.includes(REVIEW_URL_SETTING_KEY), "the form has no review url field");
  assert.ok(source.includes(GOOGLE_PLACE_ID_SETTING_KEY), "the form has no place id field");
});

test("the email logo exists as a small png", async () => {
  const info = await stat(EMAIL_LOGO);
  assert.ok(info.isFile(), `${EMAIL_LOGO} is not a file`);
  // Small enough that no mail client refuses it, big enough to be a real render.
  assert.ok(info.size > 1_000, `${EMAIL_LOGO} is suspiciously small (${info.size} bytes)`);
  assert.ok(info.size < 50_000, `${EMAIL_LOGO} is too heavy for an email (${info.size} bytes)`);
});

test("the email logo is a png, not an svg with a png name", async () => {
  const header = (await readFile(EMAIL_LOGO)).subarray(0, 8);
  assert.deepEqual([...header], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test("both review environment variables are documented", async () => {
  const example = await readFile(".env.example", "utf8");
  assert.match(example, /^GOOGLE_PLACES_API_KEY=/m);
  assert.match(example, /^GOOGLE_REVIEWS_CRON_SECRET=/m);
});

test("the settings route cannot be rewritten from another site", async () => {
  const source = await readFile("app/api/admin/settings/route.ts", "utf8");
  // Without this, any page could make a logged-in admin's browser change these
  // values, the Google review link among them.
  assert.match(source, /isSameOriginMutation/, "the write path has no origin check");
});

test("the on-demand rating route is guarded like every other admin write", async () => {
  const source = await readFile("app/api/admin/reviews/rating/route.ts", "utf8");
  assert.match(source, /getAdminSession/, "no session check");
  assert.match(source, /isSameOriginMutation/, "no origin check");
  assert.match(source, /export async function POST/, "measuring must not sit behind a GET");
  assert.ok(!/export async function GET/.test(source), "a GET would let any page trigger a measurement");
});
