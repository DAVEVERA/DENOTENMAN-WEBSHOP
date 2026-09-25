import { google } from "googleapis";

const API_VERSION = "v25";

// Geo target constant IDs (Netherlands, Belgium) and language constant ID (Dutch) used to
// target every published campaign by default, since De Notenman ships only to NL/BE and its
// ad copy is Dutch. IDs are the stable, persistent Criterion IDs Google Ads assigns to these
// resources (see https://developers.google.com/google-ads/api/docs/targeting/location-targeting
// for the geoTargetConstants/{id} resource-name format). NL=2528 and BE=2056 are grounded
// against Google's published geo targets list (cross-checked via
// https://mixedanalytics.com/blog/google-ads-analytics-geo-target-ids/, itself sourced from
// Google's official geo target CSV). The Dutch language ID (1010) follows the same
// long-stable AdWords/Google Ads numbering (e.g. English=1000, German=1001, French=1002); it
// could not be re-verified against a live, fetchable source in this environment, so verify it
// with a GAQL query (`SELECT language_constant.id FROM language_constant WHERE
// language_constant.code = 'nl'`) before relying on it for real spend. Both are overridable via
// env vars so a wrong default never needs a code change.
const DEFAULT_LOCATION_GEO_TARGET_IDS = ["2528", "2056"]; // Netherlands, Belgium
const DEFAULT_LANGUAGE_CONSTANT_ID = "1010"; // Dutch (nl)

function locationGeoTargetIds(): string[] {
  const override = process.env.GOOGLE_ADS_LOCATION_GEO_TARGET_IDS?.trim();
  if (!override) return DEFAULT_LOCATION_GEO_TARGET_IDS;
  return override.split(",").map((id) => id.trim()).filter(Boolean);
}

function languageConstantId(): string {
  return process.env.GOOGLE_ADS_LANGUAGE_CONSTANT_ID?.trim() || DEFAULT_LANGUAGE_CONSTANT_ID;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`GOOGLE_ADS_CONFIG_MISSING:${name}`);
  return value;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function googleAdsConfigurationState() {
  const requiredNames = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"];
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  return { configured: missing.length === 0, missing };
}

async function accessToken(): Promise<string> {
  const oauth = new google.auth.OAuth2(required("GOOGLE_ADS_CLIENT_ID"), required("GOOGLE_ADS_CLIENT_SECRET"));
  oauth.setCredentials({ refresh_token: required("GOOGLE_ADS_REFRESH_TOKEN") });
  const response = await oauth.getAccessToken();
  if (!response.token) throw new Error("GOOGLE_ADS_ACCESS_TOKEN_FAILED");
  return response.token;
}

async function mutate(service: string, operations: unknown[]) {
  const customerId = digits(required("GOOGLE_ADS_CUSTOMER_ID"));
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/${service}:mutate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "developer-token": required("GOOGLE_ADS_DEVELOPER_TOKEN"),
      ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { "login-customer-id": digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operations }),
  });
  const body = await response.json().catch(() => null) as { results?: { resourceName?: string }[]; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`GOOGLE_ADS_API_ERROR:${body?.error?.message ?? response.status}`);
  const resourceName = body?.results?.[0]?.resourceName;
  if (!resourceName) throw new Error("GOOGLE_ADS_RESOURCE_MISSING");
  return resourceName;
}

export async function createPausedProductAd(input: {
  name: string;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  dailyBudgetMicros: number;
  keywords: string[];
}) {
  const keywords = input.keywords.map((keyword) => keyword.trim()).filter(Boolean);
  // A SEARCH campaign with no keywords can never match a query and will serve zero
  // impressions forever; refuse to create it rather than silently publishing dead spend.
  if (keywords.length === 0) throw new Error("GOOGLE_ADS_NO_KEYWORDS");

  const suffix = Date.now().toString(36);
  const budget = await mutate("campaignBudgets", [{ create: { name: `De Notenman | ${input.name} | Budget | ${suffix}`, amountMicros: String(input.dailyBudgetMicros), deliveryMethod: "STANDARD", explicitlyShared: false } }]);
  const campaign = await mutate("campaigns", [{ create: { name: `De Notenman | ${input.name} | ${suffix}`, status: "PAUSED", advertisingChannelType: "SEARCH", campaignBudget: budget, containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING", manualCpc: {}, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false } } }]);
  const adGroup = await mutate("adGroups", [{ create: { name: `${input.name} | Advertentiegroep`, campaign, status: "ENABLED", type: "SEARCH_STANDARD", cpcBidMicros: "500000" } }]);
  const ad = await mutate("adGroupAds", [{ create: { adGroup, status: "PAUSED", ad: { finalUrls: [input.finalUrl], responsiveSearchAd: { headlines: input.headlines.map((text) => ({ text })), descriptions: input.descriptions.map((text) => ({ text })) } } } }]);
  // Ad-group-level keyword criteria: without these the campaign can never serve. The ad
  // itself stays PAUSED above (paused-by-default philosophy); keywords are ENABLED so
  // enabling the ad later is all that's needed to go live.
  await mutate("adGroupCriteria", keywords.map((text) => ({ create: { adGroup, status: "ENABLED", keyword: { text, matchType: "PHRASE" } } })));
  // Campaign-level location + language targeting, defaulting to how this shop actually
  // operates: ships to NL/BE only, Dutch ad copy. Without this a campaign that does serve
  // could target the entire world in every language.
  await mutate("campaignCriteria", [
    ...locationGeoTargetIds().map((geoTargetId) => ({ create: { campaign, location: { geoTargetConstant: `geoTargetConstants/${geoTargetId}` } } })),
    { create: { campaign, language: { languageConstant: `languageConstants/${languageConstantId()}` } } },
  ]);
  return { campaign, adGroup, ad };
}

export async function setProductAdStatus(resourceName: string, enabled: boolean): Promise<void> {
  await mutate("adGroupAds", [{ update: { resourceName, status: enabled ? "ENABLED" : "PAUSED" }, updateMask: "status" }]);
}
