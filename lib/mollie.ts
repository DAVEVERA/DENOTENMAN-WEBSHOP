import { createMollieClient, type MollieClient } from "@mollie/api-client";

let client: MollieClient | undefined;

function apiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) {
    throw new Error("MOLLIE_API_KEY is not configured");
  }
  return key;
}

// Lazily constructed so importing this module (e.g. during `next build`'s
// route data collection) never requires MOLLIE_API_KEY to be present —
// only an actual request at runtime does.
export function getMollieClient(): MollieClient {
  if (!client) {
    client = createMollieClient({ apiKey: apiKey() });
  }
  return client;
}

export function isMollieLiveMode(): boolean {
  return apiKey().startsWith("live_");
}
