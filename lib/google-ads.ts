import { google } from "googleapis";

const API_VERSION = "v25";

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
}) {
  const suffix = Date.now().toString(36);
  const budget = await mutate("campaignBudgets", [{ create: { name: `De Notenman | ${input.name} | Budget | ${suffix}`, amountMicros: String(input.dailyBudgetMicros), deliveryMethod: "STANDARD", explicitlyShared: false } }]);
  const campaign = await mutate("campaigns", [{ create: { name: `De Notenman | ${input.name} | ${suffix}`, status: "PAUSED", advertisingChannelType: "SEARCH", campaignBudget: budget, containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING", manualCpc: {}, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false } } }]);
  const adGroup = await mutate("adGroups", [{ create: { name: `${input.name} | Advertentiegroep`, campaign, status: "ENABLED", type: "SEARCH_STANDARD", cpcBidMicros: "500000" } }]);
  const ad = await mutate("adGroupAds", [{ create: { adGroup, status: "PAUSED", ad: { finalUrls: [input.finalUrl], responsiveSearchAd: { headlines: input.headlines.map((text) => ({ text })), descriptions: input.descriptions.map((text) => ({ text })) } } } }]);
  return { campaign, adGroup, ad };
}

export async function setProductAdStatus(resourceName: string, enabled: boolean): Promise<void> {
  await mutate("adGroupAds", [{ update: { resourceName, status: enabled ? "ENABLED" : "PAUSED" }, updateMask: "status" }]);
}
