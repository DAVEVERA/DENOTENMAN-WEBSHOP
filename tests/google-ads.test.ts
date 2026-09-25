import assert from "node:assert/strict";
import test from "node:test";
import { google } from "googleapis";
import { createPausedProductAd } from "../lib/google-ads";

type MutateOperation = Record<string, unknown>;
type MutateCall = { service: string; operations: MutateOperation[] };

const originalFetch = global.fetch;
const originalGetAccessToken = google.auth.OAuth2.prototype.getAccessToken;
const requiredEnv = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
] as const;
const originalEnv = Object.fromEntries(requiredEnv.map((name) => [name, process.env[name]]));

function restore() {
  global.fetch = originalFetch;
  google.auth.OAuth2.prototype.getAccessToken = originalGetAccessToken;
  for (const name of requiredEnv) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
}

// googleapis' OAuth2Client refreshes tokens through its own transport, not the global
// fetch — stub the prototype method instead so tests never touch the real network.
function stubAccessToken() {
  google.auth.OAuth2.prototype.getAccessToken = async () => ({ token: "test-access-token" });
}

/** Records every `:mutate` call lib/google-ads.ts makes and returns a canned success response. */
function stubMutateFetch(): MutateCall[] {
  const calls: MutateCall[] = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const match = url.match(/\/([a-zA-Z]+):mutate$/);
    const service = match?.[1] ?? "unknown";
    const operations = JSON.parse(String(init?.body)).operations as MutateOperation[];
    calls.push({ service, operations });
    const results = operations.map((_, index) => ({ resourceName: `customers/1234567890/${service}/${index}` }));
    return Response.json({ results });
  }) as typeof fetch;
  return calls;
}

test.beforeEach(() => {
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
  process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
  process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_ADS_REFRESH_TOKEN = "refresh-token";
  process.env.GOOGLE_ADS_CUSTOMER_ID = "123-456-7890";
  stubAccessToken();
});

test.afterEach(restore);

test("publishing without keywords is rejected before any Google Ads API call", async () => {
  const calls = stubMutateFetch();

  await assert.rejects(
    () => createPausedProductAd({
      name: "Amandelen",
      headlines: ["Amandelen", "Vers geroosterd", "Bestel nu"],
      descriptions: ["Verse amandelen.", "Snel geleverd."],
      finalUrl: "https://denotenman.com/nl/producten/amandelen",
      dailyBudgetMicros: 5_000_000,
      keywords: [],
    }),
    (error: unknown) => error instanceof Error && error.message === "GOOGLE_ADS_NO_KEYWORDS",
  );
  // Blank/whitespace-only entries don't count as real keywords either.
  await assert.rejects(
    () => createPausedProductAd({
      name: "Amandelen",
      headlines: ["Amandelen", "Vers geroosterd", "Bestel nu"],
      descriptions: ["Verse amandelen.", "Snel geleverd."],
      finalUrl: "https://denotenman.com/nl/producten/amandelen",
      dailyBudgetMicros: 5_000_000,
      keywords: ["   ", ""],
    }),
    (error: unknown) => error instanceof Error && error.message === "GOOGLE_ADS_NO_KEYWORDS",
  );

  assert.equal(calls.length, 0, "no mutate call should ever be sent for a campaign with zero keywords");
});

test("publishing with keywords sends ad-group keyword criteria and campaign location/language criteria", async () => {
  const calls = stubMutateFetch();

  await createPausedProductAd({
    name: "Amandelen",
    headlines: ["Amandelen", "Vers geroosterd", "Bestel nu"],
    descriptions: ["Verse amandelen.", "Snel geleverd."],
    finalUrl: "https://denotenman.com/nl/producten/amandelen",
    dailyBudgetMicros: 5_000_000,
    keywords: ["amandelen kopen", "  biologische noten  ", ""],
  });

  const services = calls.map((call) => call.service);
  assert.deepEqual(services, ["campaignBudgets", "campaigns", "adGroups", "adGroupAds", "adGroupCriteria", "campaignCriteria"]);

  const keywordCall = calls.find((call) => call.service === "adGroupCriteria");
  assert.ok(keywordCall, "expected an adGroupCriteria:mutate call");
  // Blank entries are dropped and the rest are trimmed before becoming keyword criteria.
  assert.deepEqual(
    keywordCall!.operations.map((operation) => (operation.create as Record<string, unknown>).keyword),
    [
      { text: "amandelen kopen", matchType: "PHRASE" },
      { text: "biologische noten", matchType: "PHRASE" },
    ],
  );
  for (const operation of keywordCall!.operations) {
    const create = operation.create as Record<string, unknown>;
    assert.equal(create.status, "ENABLED", "keyword criteria stay enabled; the ad itself is what's paused");
  }

  const criteriaCall = calls.find((call) => call.service === "campaignCriteria");
  assert.ok(criteriaCall, "expected a campaignCriteria:mutate call");
  const locations = criteriaCall!.operations
    .map((operation) => (operation.create as Record<string, unknown>).location)
    .filter(Boolean);
  const languages = criteriaCall!.operations
    .map((operation) => (operation.create as Record<string, unknown>).language)
    .filter(Boolean);
  // Defaults to Netherlands + Belgium (this shop ships NL/BE only) and Dutch (its ad copy).
  assert.deepEqual(locations, [
    { geoTargetConstant: "geoTargetConstants/2528" },
    { geoTargetConstant: "geoTargetConstants/2056" },
  ]);
  assert.deepEqual(languages, [{ languageConstant: "languageConstants/1010" }]);
});

test("location and language defaults can be overridden via env vars", async () => {
  const calls = stubMutateFetch();
  process.env.GOOGLE_ADS_LOCATION_GEO_TARGET_IDS = "2276"; // Germany, for this test only
  process.env.GOOGLE_ADS_LANGUAGE_CONSTANT_ID = "1001"; // German

  await createPausedProductAd({
    name: "Amandelen",
    headlines: ["Amandelen", "Vers geroosterd", "Bestel nu"],
    descriptions: ["Verse amandelen.", "Snel geleverd."],
    finalUrl: "https://denotenman.com/nl/producten/amandelen",
    dailyBudgetMicros: 5_000_000,
    keywords: ["amandelen kopen"],
  });

  delete process.env.GOOGLE_ADS_LOCATION_GEO_TARGET_IDS;
  delete process.env.GOOGLE_ADS_LANGUAGE_CONSTANT_ID;

  const criteriaCall = calls.find((call) => call.service === "campaignCriteria");
  const locations = criteriaCall!.operations.map((operation) => (operation.create as Record<string, unknown>).location).filter(Boolean);
  const languages = criteriaCall!.operations.map((operation) => (operation.create as Record<string, unknown>).language).filter(Boolean);
  assert.deepEqual(locations, [{ geoTargetConstant: "geoTargetConstants/2276" }]);
  assert.deepEqual(languages, [{ languageConstant: "languageConstants/1001" }]);
});
